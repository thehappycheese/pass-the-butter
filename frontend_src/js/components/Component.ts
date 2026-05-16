

export class Component {
    host: HTMLElement;
    constructor(host: HTMLElement) {
        this.host = host;
    }
    append_to(parent: HTMLElement) {
        if (this.host) {
            parent.appendChild(this.host);
        }
    }
    dom(){
        return this.host;
    }
}
