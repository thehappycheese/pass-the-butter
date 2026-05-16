import { delay } from "./delay";

export async function flow_text_into_input(text: string, consumer: (text: string) => void) {
    if (text.length === 0) return;
    for (let pointer = 1; pointer <= text.length; pointer++) {
        consumer(text.slice(0, pointer));
        await delay(15);
    }
}
