
export type SSEEvent ={
    event:string;
    data:any;
}

export type  AsyncIterSSE = AsyncGenerator<SSEEvent, void, unknown>;

export async function* iter_sse(response:Response):AsyncIterSSE{
    const reader = response.body?.getReader();
    if (reader===undefined) {
        console.log(response);
        throw new Error("Response had no body");
    }
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // Normalize CRLF to LF so we only have to handle one case
        buf = buf.replace(/\r\n/g, "\n");

        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            let event = null;
            const dataLines = [];
            for (const line of raw.split("\n")) {
                if (line.startsWith("event:")) event = line.slice(6).trim();
                else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
            }
            if (event && dataLines.length) {
                yield { event, data: JSON.parse(dataLines.join("\n")) };
            }
        }
    }
}
