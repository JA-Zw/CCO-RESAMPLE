const { app } = require('@azure/functions');
const { BlobServiceClient } = require("@azure/storage-blob");
const { RiffWav } = require("../../struct/riff-wav.js");
const KS = require("kaitai-struct/KaitaiStream");

const AZURE_STORAGE_CONNECTION_STRING = process.env.AzureWebJobsStorage;

class DataView24 extends DataView {
    getInt24 (offset, endian){
        //we gaan sws le doen, dus we negeren endian
        return this.getUint8(offset) | (this.getUint8(offset+1) << 8)  | (this.getInt8(offset+2) << 16);
    }
    setInt24 (offset, value, endian){
        //we gaan sws le doen, dus we negeren endian
        const bValue = value >>> 0; // hetzelfde getal, maar met de sign op 0;
        this.setUint8(offset, Math.round(bValue) % 256);
        this.setUint8(offset+1, (bValue >> 8) % 256);
        this.setInt8(offset+2, (value >> 16) % 256); // hier is de sign er weer
    }
}

app.http('resample', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        if(!request.query.has("rate")) return {status: 400, body: "de query-parameter \"rate\" is verplicht"}
        const uitvoerSampleRate = parseInt(request.query.get("rate"));
        if(Number.isNaN(uitvoerSampleRate)) return {status: 400, body: "de query-parameter \"rate\" is geen nummer"}

        const body = Buffer.concat(await Array.fromAsync(request.body));
        try {
            var wav = new RiffWav(new KS(body));
        } catch(e){
            return {body: "je wavbestand is slecht: "+ e.toString(), status: 400};
        }
        const fmt  = wav.inhoud.blokken.find(blok=>{return blok.id == "fmt "}).inhoud;
        const fact = wav.inhoud.blokken.find(blok=>{return blok.id == "fact"})?.inhoud;
        const data = wav.inhoud.blokken.find(blok=>{return blok.id == "data"}).inhoud;
        
        const invoerKanalen = [];
        try{
            const sampleData = data.inhoud; //is uint8array 
            const sampleDataView = new DataView24(sampleData.buffer, sampleData.byteOffset, sampleData.byteLength);
            let uitleesFunctie;
            const format = fmt.werkelijkFormat ?? fmt.format;
            switch(format){
                case 1: //int
                    switch(fmt.bitsPerSample){
                        // case 64:
                        //     uitleesFunctie = sampleDataView.getBigInt64;
                        //     break;
                        // deze doen we niet want dat wordt geen Number, maar een BigInt, en daar heb ik geen zin in. Niemand gebruikt dit toch.
                        case 32:
                            uitleesFunctie = sampleDataView.getInt32;
                            schrijfFunctie = "setInt32";
                            break;
                        case 24:
                            uitleesFunctie = sampleDataView.getInt24;
                            schrijfFunctie = "setInt24";
                            break;
                        case 16:
                            uitleesFunctie = sampleDataView.getInt16;
                            schrijfFunctie = "setInt16";
                            break;
                        case 8:
                            uitleesFunctie = sampleDataView.getInt8;
                            schrijfFunctie = "setInt8";
                            break;
                        default:
                            return {status: 400, body: `bestand is van het type int${fmt.bitsPerSample} en wordt niet ondersteund`}
                    }
                    break;
                case 3: //float
                    switch(fmt.bitsPerSample){
                        case 64:
                            uitleesFunctie = sampleDataView.getFloat64;
                            schrijfFunctie = "setFloat64";
                            break;
                        case 32:
                            uitleesFunctie = sampleDataView.getFloat32;
                            schrijfFunctie = "setFloat32";
                            break;
                        case 16:
                            uitleesFunctie = sampleDataView.getFloat16;
                            schrijfFunctie = "setFloat16";
                            break;
                        default:
                            return {status: 400, body: `bestand is van het type float${fmt.bitsPerSample} en wordt niet ondersteund`}
                    }
                    break;
                default:
                    return {status: 400, body: `bestand is van het type ${fmt.werkelijkFormat ?? fmt.format}, ${fmt.bitsPerSample} en wordt niet ondersteund`};
            }
            // dit doen we omdat we oop achterstevoren aan het doen zijn.
            uitleesFunctie = uitleesFunctie.bind(sampleDataView);

            const bytesPerSample = Math.ceil(fmt.bitsPerSample / 8);
            for(let i = 0; i < sampleData.length / fmt.blokGrootte; i++){
                for(let k = 0; k < fmt.kanalen; k++){
                    if(i == 0) invoerKanalen[k] = [];
                    const positie = i * fmt.blokGrootte + k * bytesPerSample;
                    invoerKanalen[k][i] = uitleesFunctie(positie, true);
                }
            }
            //console.log(invoerKanalen);
            const origineleSampleRate = fmt.sampleRate;
            const origineleLengte = fact?.totaalSamples ?? sampleData.length / fmt.blokGrootte;
            const uitvoerLengte = Math.round(origineleLengte / origineleSampleRate * uitvoerSampleRate);
            const uitvoerKanalen = invoerKanalen.map(origineleSamples=>{
                const uitvoerSamples = [];
                for(let i = 0; i < uitvoerLengte; i++){
                    const i_origineel = i / uitvoerSampleRate * origineleSampleRate;
                    const a = Math.floor(i_origineel);
                    const b = a + 1;
                    const a_waarde = origineleSamples[a];
                    if(b >= origineleLengte) var b_waarde = 0;
                    else var b_waarde = origineleSamples[a];
                    const b_weging = i_origineel - a;
                    const a_weging = 1 - b_weging;
                    uitvoerSamples.push(a_waarde * a_weging + b_waarde * b_weging);
                }
                return uitvoerSamples;
            });

            const uitvoerGrootte = 12 // RIFF blok
                            + uitvoerLengte * fmt.blokGrootte + 8 // data blok
                            + 24 // fmt  blok
                            + 12 // fact blok
            ;
            const nieuwBestand = new ArrayBuffer(uitvoerGrootte);
            const uitvoerView = new DataView24(nieuwBestand);

            //jaja, weer dit
            const schrijf = uitvoerView[schrijfFunctie].bind(uitvoerView);

            let offset = 0;
            //RIFF blok
            offset = schrijfString(uitvoerView, offset, "RIFF");
            uitvoerView.setUint32(offset, uitvoerGrootte - 8, true); offset += 4;
            offset = schrijfString(uitvoerView, offset, "WAVE");

            //fmt  blok
            offset = schrijfString(uitvoerView, offset, "fmt ");
            uitvoerView.setUint32(offset, 16, true); offset += 4; //grootte blok
            uitvoerView.setUint16(offset, format, true); offset += 2;
            uitvoerView.setUint16(offset, fmt.kanalen, true); offset += 2;
            uitvoerView.setUint32(offset, uitvoerSampleRate, true); offset += 4;
            uitvoerView.setUint32(offset, uitvoerSampleRate * fmt.blokGrootte, true); offset += 4;
            uitvoerView.setUint16(offset, fmt.blokGrootte, true); offset += 2;
            uitvoerView.setUint16(offset, fmt.bitsPerSample, true); offset += 2;

            //fact blok
            offset = schrijfString(uitvoerView, offset, "fact");
            uitvoerView.setUint32(offset, 4, true); offset += 4; //grootte blok
            uitvoerView.setUint32(offset, uitvoerLengte, true); offset += 4; //grootte blok

            //data blok
            offset = schrijfString(uitvoerView, offset, "data");
            uitvoerView.setUint32(offset, uitvoerLengte * fmt.blokGrootte, true); offset += 4; //grootte blok
            for(let i = 0; i < uitvoerLengte; i++){
                let ioff = 0;
                for(let k = 0; k < fmt.kanalen; k++){
                    if(format == 1){
                        if(schrijfFunctie == "setInt8") schrijf(offset + ioff, Math.round(uitvoerKanalen[k][i]));
                        else schrijf(offset + ioff, Math.round(uitvoerKanalen[k][i]), true);
                    } else {
                        schrijf(offset + ioff, uitvoerKanalen[k][i], true);
                    }
                    ioff += bytesPerSample;
                }
                offset += fmt.blokGrootte;
            }

            
            const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
            const outputContainerClient = blobServiceClient.getContainerClient("resampled");
            await outputContainerClient.createIfNotExists();

            const blockBlobClient = outputContainerClient.getBlockBlobClient(crypto.randomUUID() + ".wav");
            await blockBlobClient.uploadData(nieuwBestand, {
                blobHTTPHeaders: {
                    blobContentType: "audio/x-wav"
                }
            });

            return {body: await blockBlobClient.generateSasUrl({permissions: "read", expiresOn: new Date(Date.now() + 60*60*1000)}), status: 200};


        } catch(e){
            console.error(e);
            return  {body: "fout bij wav uitlezen of resamplen: "+ e.toString(), status: 500};
        }


        //return {body: "mauw: ", status: 200};
    }
});

function schrijfString(view, offset, string){
    for(const char of string){
        view.setUint8(offset, char.charCodeAt(0));
        offset++;
    }

    return offset;
}
