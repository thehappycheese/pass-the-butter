"use strict";
(() => {
  // static/js/util/queue.js
  var Queue = class {
    /** @type {T[]} */
    #items = [];
    /**
     * Add a value to the back of the queue.
     * @param {T} value
     * @returns {void}
     */
    enqueue(value) {
      this.#items.push(value);
    }
    /**
     * Remove and return the value at the front of the queue.
     * @returns {T | undefined}
     */
    dequeue() {
      return this.#items.shift();
    }
    /**
     * Return the value at the front without removing it.
     * @returns {T | undefined}
     */
    peek() {
      return this.#items[0];
    }
    /** @returns {number} */
    get size() {
      return this.#items.length;
    }
    /** @returns {boolean} */
    empty() {
      return this.#items.length === 0;
    }
    /** @returns {boolean} */
    not_empty() {
      return this.#items.length > 0;
    }
    /**
     * Iterate front-to-back without mutating the queue.
     * @returns {IterableIterator<T>}
     */
    *[Symbol.iterator]() {
      yield* this.#items;
    }
  };

  // static/js/util/hyperscript.js
  function h(tag, options = {}, children) {
    const el = document.createElement(tag);
    const { props, style, attrs, data, class: klass, on } = options;
    if (props) Object.assign(el, props);
    if (style) Object.assign(el.style, style);
    if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (data) Object.assign(el.dataset, data);
    if (klass) el.className = Array.isArray(klass) ? klass.join(" ") : klass;
    if (on) {
      for (const [event, handler] of Object.entries(on)) {
        el.addEventListener(event, handler);
      }
    }
    if (children != null) {
      el.append(...Array.isArray(children) ? children : [children]);
    }
    return el;
  }

  // static/js/core/log_view.js
  var function_format = (name, args) => `${name}${Object.keys(args).length === 0 ? "()" : `(
${Object.entries(args).map(([k, v]) => `  ${k} = ${JSON.stringify(v)},`).join("\n")}
)`}`;
  var MessageDom = class {
    /** @type {HTMLDivElement} */
    host;
    /** @type {HTMLDivElement} */
    label;
    /** @type {HTMLDivElement} */
    body;
    /**
     * @param {HTMLDivElement} host
     * @param {HTMLDivElement} label
     * @param {HTMLDivElement} body
     */
    constructor(host, label, body) {
      this.host = host;
      this.label = label;
      this.body = body;
    }
  };
  function approvals_all_resolved(approvals) {
    return Object.values(approvals).every((i) => i.approved !== null);
  }
  var LogView = class {
    /** @type {ResumeFunc} */
    resume;
    /**
     * @type {Queue<() => Promise<import("../util/sse.js").AsyncIterSSE>>} Thunks that will be thought
     */
    train_of_thunk;
    /** @type {boolean} if the think() method is currently working this internal flag stops it from retriggering */
    thinking;
    /**
     * @type {MessageDom[]}
     */
    message_log;
    /** @type {Record<string, MessageDom>}*/
    tool_calls;
    /** @type {null|Record<string, ApprovalState>} */
    approvals;
    /**
     * @type {HTMLElement} element where the log will be rendered
     */
    host;
    /**
     * @param {HTMLElement} host Element where the log will be rendered
     * @param {(approvals:Record<string, ApprovalState>) => void} resume
     */
    constructor(host, resume) {
      this.resume = resume;
      this.host = host;
      this.approvals = null;
      this.thinking = false;
      this.message_log = [];
      this.tool_calls = {};
      this.train_of_thunk = new Queue();
    }
    scroll_bottom() {
      this.host.scrollTop = this.host.scrollHeight;
    }
    /**
     * @param {string} id
     * @param {string} name
     * @param {Record<string,any>} args
     * @returns {MessageDom}
     */
    add_tool_call(id, name, args) {
      const dom = this.add_entry(
        "tool_call",
        "Tool Call",
        function_format(name, args)
      );
      this.tool_calls[id] = dom;
      return dom;
    }
    /**
     * @param {string} tool_call_id
     * @param {string} message
     * @returns {MessageDom}
     */
    add_tool_call_result(tool_call_id, message) {
      const dom = this.tool_calls?.[tool_call_id] ?? this.add_tool_call(
        tool_call_id,
        "unknown",
        {}
      );
      dom.body.appendChild(h("div", { class: "tool_call_result" }, "Result: " + message));
      this.scroll_bottom();
      return dom;
    }
    /**
     * 
     * @param {string} tool_call_id
     */
    add_request_for_approval(tool_call_id) {
      const dom = this.tool_calls?.[tool_call_id] ?? this.add_tool_call(
        tool_call_id,
        `unknown (Request for Approval looked for tool call id ${tool_call_id})`,
        {}
      );
      const on_approve = () => {
        approval_form.remove();
        this.set_approval_result(tool_call_id, true);
        dom.body.append(h(
          "div",
          { class: "approval_form_user_approved" },
          "User Action: APPROVED TOOL CALL"
        ));
      };
      const on_deny = () => {
        approval_form.remove();
        this.set_approval_result(tool_call_id, false);
        dom.body.append(h(
          "div",
          { class: "approval_form_user_denied" },
          "User Action: DENIED TOOL CALL"
        ));
      };
      const approval_form = h("div", {
        class: "approval_form"
      }, [
        h("div", {}, "Allow this tool to run:"),
        h("div", {
          style: {
            display: "flex",
            gap: "2em"
          }
        }, [
          h("button", { on: { click: on_approve } }, "YES"),
          h("button", { on: { click: on_deny } }, "NO")
        ])
      ]);
      dom.body.appendChild(approval_form);
      this.scroll_bottom();
      return dom;
    }
    /**
     * 
     * @param {string} tool_call_id 
     * @param {boolean} result 
     */
    set_approval_result(tool_call_id, result) {
      if (this.approvals === null || !(tool_call_id in this.approvals)) {
        throw new Error(`unexpected approval ${tool_call_id} ${result}`);
      }
      this.approvals[tool_call_id].approved = result;
      if (approvals_all_resolved(this.approvals)) {
        this.resume(this.approvals);
        this.clear_approvals();
        this.think();
      }
    }
    /**
     * 
     * @param {string} tool_call_id 
     * @param {string} interrupt_id
     */
    init_approval(tool_call_id, interrupt_id) {
      const a = this.approvals || {};
      this.approvals = a;
      a[tool_call_id] = {
        tool_call_id,
        interrupt_id,
        approved: null
      };
    }
    clear_approvals() {
      this.approvals = null;
    }
    /**
     * @param {string} cls css class
     * @param {string} label heading
     * @param {string} text body content
     */
    add_entry(cls, label, text) {
      const l = h("div", { class: "label" }, label);
      const b = h("div", { class: "body" }, text);
      const div = h("div", { class: ["entry", cls] }, [l, b]);
      this.host.appendChild(div);
      this.scroll_bottom();
      const msg_dom = new MessageDom(div, l, b);
      this.message_log.push(msg_dom);
      return msg_dom;
    }
    /**
     * @param {AsyncGenerator<StreamMessage>} events
     */
    async handle_stream(events) {
      let assistant_body = null;
      for await (const { event, data } of events) {
        if (event === "token") {
          if (!assistant_body) {
            assistant_body = this.add_entry("assistant", "assistant", "");
          }
          assistant_body.body.textContent += data.text;
          this.scroll_bottom();
        } else {
          assistant_body = null;
          if (event === "tool_call") {
            this.add_tool_call(
              data.id,
              data.name,
              data.args
            );
          } else if (event === "tool_result") {
            this.add_tool_call_result(data.id, data.content);
          } else if (event === "error") {
            this.add_entry("error", "error", data.message);
          } else if (event === "done") {
            this.add_entry("done", "done", "");
          } else if (event === "approval_required") {
            const { tool, args, tool_call_id, interrupt_id } = data;
            this.init_approval(tool_call_id, interrupt_id);
            this.add_request_for_approval(
              tool_call_id
            );
          } else {
            this.add_entry("unknown", "event", JSON.stringify(data));
          }
        }
      }
    }
    async think() {
      if (this.thinking) {
        return;
      }
      this.thinking = true;
      while (this.train_of_thunk.not_empty()) {
        const next = this.train_of_thunk.dequeue();
        if (!next) break;
        await this.handle_stream(
          await next()
        );
      }
      this.thinking = false;
    }
  };

  // static/js/util/sse.js
  async function* iter_sse(response) {
    const reader = response.body?.getReader();
    if (reader === void 0) {
      console.log(response);
      throw new Error("Response had no body");
    }
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
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

  // static/js/core/api.js
  async function endpoint_stream(user_message, session_id) {
    const response = await fetch("/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_message,
        session_id
      })
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return iter_sse(response);
  }
  async function endpoint_resume(approvals, session_id) {
    const response = await fetch("/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approvals,
        session_id
      })
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return iter_sse(response);
  }

  // static/js/core/add_suggested_questions.ts
  function add_suggested_questions(host, set_value) {
    const controller = new AbortController();
    const { signal } = controller;
    const sb = document.createElement("div");
    sb.setAttribute("style", "min-height:100%; display:grid; grid-template-rows: 1fr; grid-auto-rows:auto; gap:0.5em; margin-bottom: 1em;");
    const padder = document.createElement("div");
    sb.appendChild(padder);
    host.appendChild(sb);
    const add_suggestion = (value) => {
      const button = document.createElement("button");
      button.textContent = value;
      sb.appendChild(button);
      button.addEventListener("click", () => {
        controller.abort();
        sb.remove();
        set_value(value);
      }, { signal });
    };
    add_suggestion("What can you do?");
    add_suggestion("Who works here?");
    add_suggestion("Who is Bob?");
    add_suggestion("Does Bob or Dana have access to a larger budget?");
    add_suggestion("Please transfer bob's unspent budget to dana.");
    add_suggestion("Please add 10k to budget B-2026-01");
    add_suggestion("please increment the dummy counter as two tool calls in the same turn");
    return sb;
  }

  // static/js/util/delay.ts
  async function delay(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  // static/js/util/flow_text_into_input.ts
  async function flow_text_into_input(text, consumer) {
    if (text.length === 0) return;
    for (let pointer = 1; pointer <= text.length; pointer++) {
      consumer(text.slice(0, pointer));
      await delay(15);
    }
  }

  // static/js/index.ts
  var SESSION_ID = crypto.randomUUID();
  var log = document.getElementById("log");
  var form = document.getElementById("form");
  var input = document.getElementById("input");
  var send = document.getElementById("send");
  var logview = new LogView(
    log,
    (approvals) => {
      logview.train_of_thunk.enqueue(
        async () => await endpoint_resume(approvals, SESSION_ID)
      );
    }
  );
  add_suggested_questions(
    log,
    async (value) => {
      await flow_text_into_input(value, (text) => input.value = text);
      await delay(100);
      send.click();
    }
  );
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    send.disabled = true;
    logview.add_entry("user", "user", message);
    logview.train_of_thunk.enqueue(async () => await endpoint_stream(message, SESSION_ID));
    try {
      await logview.think();
    } finally {
      send.disabled = false;
      input.focus();
    }
  });
  input.focus();
})();
//# sourceMappingURL=index.js.map
