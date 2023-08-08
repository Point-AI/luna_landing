(function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function append_styles(target, style_sheet_id, styles) {
        const append_styles_to = get_root_for_style(target);
        if (!append_styles_to.getElementById(style_sheet_id)) {
            const style = element('style');
            style.id = style_sheet_id;
            style.textContent = styles;
            append_stylesheet(append_styles_to, style);
        }
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element.sheet;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
        return style.sheet;
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value == null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    const managed_styles = new Map();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash$1(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_style_information(doc, node) {
        const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
        managed_styles.set(doc, info);
        return info;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash$1(rule)}_${uid}`;
        const doc = get_root_for_style(node);
        const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
        if (!rules[name]) {
            rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            managed_styles.forEach(info => {
                const { ownerNode } = info.stylesheet;
                // there is no ownerNode if it runs on jsdom.
                if (ownerNode)
                    detach(ownerNode);
            });
            managed_styles.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        const options = { direction: 'both' };
        let config = fn(node, params, options);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = (program.b - t);
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config(options);
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function scale(node, { delay = 0, duration = 400, easing = cubicOut, start = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const sd = 1 - start;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (_t, u) => `
			transform: ${transform} scale(${1 - (sd * u)});
			opacity: ${target_opacity - (od * u)}
		`
        };
    }

    /**
    	 * @param {number} t
    	 */
    function easing(t) {
        return t * (2 - t);
    }

    /**
     * @param {HTMLDivElement} node
     */
    function scaleUp(node) {
        return {
            delay: 0,
            duration: 300,
            css: (/** @type {number} */ t) => {
                const eased = easing(t);

                return `scale: ${eased}; transform-origin: bottom right;`;
            },
        };
    }

    /**
     * @typedef {{userId: string, chatId: string, externalId: string, platform: string, text: string, userFullName: string,}} SendMessageRequest
     */

    /**
     * @param {string} userId
     * @param {string} chatId
     * @param {import("../utils/storage").Message} message
     * @param {string} clientName
     * @returns {Promise<string>}
     */
    var send = async (userId, chatId, message, clientName) => {
        try {
            var myHeaders = new Headers();
            myHeaders.append("Content-Type", "application/json");

            /**
             * @type {SendMessageRequest}
             */
            const requestBody = {
                userId: userId,
                chatId: chatId,
                externalId: message.id.toString(),
                platform: "widget",
                text: message.text,
                userFullName: clientName,
            };

            const response = await fetch('https://api.pointai.tech/messages', {
                method: 'POST',
                headers: myHeaders,
                redirect: 'follow',
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            if (response.status !== 200) {
                console.log('Error status:', response.status);
                console.log('Error message:', data.message);
                return null;
            }

            console.log('Success:', data.text);
            return data.text;
        } catch (error) {
            console.log('Error:', error);
            return null;
        }
    };

    var getIp = async () => {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            const ipAddress = data.ip;
            console.log(ipAddress);
            return ipAddress;
        } catch (error) {
            console.log('Error:', error);
            return null;
        }
    };

    /**
     * @param {string} ipAddress
     */
    var hash = (ipAddress) => {
        const currentTime = Date.now().toString();
        const numbers = ipAddress.split(".").join("");
        const data = currentTime + numbers;

        return data;
    };

    /**
     * Chat object
     * Message object
     * @typedef {{id: string;language: string;messages: Array<Message>;}} Chat
     * @typedef {{id: number;text: string;timestamp: number;fromUser: boolean;}} Message
     * @returns {Promise<Chat>}
     * @param {string} userId
     * @param {string} defaultLanguage
     */
    async function getChat(userId, defaultLanguage) {
        const chatId = localStorage.getItem("chatId");
        if (!chatId) {
            try {
                const ip = await getIp();

                const newChatId = hash(ip);
                localStorage.setItem("chatId", newChatId);

                if (!defaultLanguage) defaultLanguage = "en";


                console.log("userId");
                console.log(userId);

                console.log(defaultLanguage);

                localStorage.setItem("language", defaultLanguage);

                return {
                    "id": newChatId,
                    "language": defaultLanguage,
                    "messages": []
                }
            } catch (error) {
                console.log(error);
                return null;
            }
        } else {
            const messagesJson = localStorage.getItem("messages");
            const messages = JSON.parse(messagesJson);
            const language = localStorage.getItem("language");

            return {
                "id": chatId,
                "language": language,
                "messages": messages ? messages : []
            }
        }
    }


    /**
     * @param {Chat} chat
     */
    async function saveChat(chat) {
        const messagesJson = JSON.stringify(chat.messages);
        localStorage.setItem("messages", messagesJson);
        localStorage.setItem("language", chat.language);
    }

    /**
     * Get languages of a user
     * @param {string} userId 
     * @returns {Promise<Array<Object>>} languages
     */
    const getLanguages = async (userId) => {
        const response = await fetch(`https://api.pointai.tech/languages/${userId}`, {
            method: 'GET',
            redirect: 'follow',
        });

        if (response.status === 200) {
            const data = await response.json();
            return data;
        } else {
            return [
                {
                    "name": "English",
                    "engName": "English",
                    "code": "en",
                    "flag": "🇺🇸",
                    "greeting": "Hello! I am an online assistant of %s company, how can I help you?"
                },
            ]
        }
    };

    /**
     * Change language of a chat
     * @param {string} userId 
     * @param {string} chatId 
     * @param {string} userName 
     * @param {string} languageCode 
     * @returns {Promise<string>}
     */
    const changeLanguage = async (userId, chatId, userName, languageCode) => {
        const response = await fetch(`https://api.pointai.tech/chats/language`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                chatId,
                platform: 'widget',
                userFullName: userName,
                language: languageCode
            }),
            redirect: 'follow',
        });

        if (response.status === 200) {
            const data = await response.json();

            return data.message;
        }
        throw new Error('Error changing language');
    };

    var name = (/** @type {string} */ userId) => {
        if (userId === "64846572d9053a395685edbf" || userId === "64bd30d0bae3200c9bef2947") {
            return "Aisha";
        }
        return "Luna";
    };

    /* src/Widget.svelte generated by Svelte v3.59.1 */

    function add_css(target) {
    	append_styles(target, "svelte-yw252a", ":root{font-family:Arial, Helvetica, sans-serif}main.svelte-yw252a.svelte-yw252a{position:fixed;z-index:2147483647;right:var(--offsetX);bottom:var(--offsetY);display:flex;flex-direction:column;gap:16px;align-items:flex-end}.chat.svelte-yw252a.svelte-yw252a{height:calc(100vh - var(--offsetY) - 100px);width:400px;background-color:white;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end}.button.svelte-yw252a.svelte-yw252a{height:72px;width:72px;border-radius:100%;background-color:#3478ff;display:flex;align-items:center;justify-content:center}.button.svelte-yw252a img.svelte-yw252a{position:absolute;height:44px}.shadow.svelte-yw252a.svelte-yw252a{box-shadow:0px 4px 12px rgba(35, 57, 90, 0.15)}.indicator.svelte-yw252a.svelte-yw252a{height:10px;width:10px;border-radius:100%;background-color:#4bff2e;border:solid #3478ff 3px;position:absolute;bottom:5px;right:5px}.text-field.svelte-yw252a.svelte-yw252a{background-color:white;height:72px;box-shadow:0px -4px 12px rgba(35, 57, 90, 0.1)}.text-field.svelte-yw252a div.svelte-yw252a{display:flex;align-items:center;padding:4px 16px 0px 16px;gap:16px}.text-field.svelte-yw252a input.svelte-yw252a{border:none;flex-grow:1;font-size:medium;padding:6px 4px}.text-field.svelte-yw252a input.svelte-yw252a:focus{outline:none}.text-field.svelte-yw252a button.svelte-yw252a{border:none;height:48px;width:48px;border-radius:12px;background:url(\"https://pointai.tech/widget/assets/send.svg\") no-repeat\n\t\t\tcenter;transition:100ms ease-in-out}.text-field.svelte-yw252a button.svelte-yw252a:active{transform:scale(0.9);background-color:#e5e5e5}.appbar.svelte-yw252a.svelte-yw252a{background:url(\"https://pointai.tech/widget/assets/gradient.svg\")\n\t\t\tno-repeat center/cover;transition:300ms ease-in-out;height:72px;display:flex;flex-direction:column;align-items:start;justify-content:center;color:white}.appbar-open.svelte-yw252a.svelte-yw252a{height:calc(100% - 72px);align-items:center}.appbar.svelte-yw252a>.title.svelte-yw252a{font-size:x-large;margin:12px 0px 0px 0px}.appbar.svelte-yw252a>.subtitle.svelte-yw252a{font-size:medium;font-weight:200;margin:4px 0px 0px 0px;text-align:center}.content.svelte-yw252a.svelte-yw252a{background-color:white;max-height:calc(100% - 144px);flex-grow:1;overflow-y:scroll;display:flex;flex-direction:column-reverse;padding:0px 16px;font-size:medium;line-height:1.3}.message.svelte-yw252a.svelte-yw252a{padding:16px;margin:4px 0px;border-radius:16px;max-width:60%}.message-user.svelte-yw252a.svelte-yw252a{align-self:flex-end;background-color:#3478ff;color:white;border-end-end-radius:4px}.message-bot.svelte-yw252a.svelte-yw252a{align-self:flex-start;background-color:#edf3fe;color:#1b2c45;border-end-start-radius:4px}.avatar-wrapper.svelte-yw252a.svelte-yw252a{display:flex;flex-direction:row;margin:0px 16px;gap:12px}.avatar-title-closed.svelte-yw252a.svelte-yw252a{display:flex;flex-direction:column;justify-content:center}.avatar-title-closed.svelte-yw252a>p.svelte-yw252a{margin:0}.avatar-subtitle.svelte-yw252a.svelte-yw252a{font-size:smaller;opacity:0.5}.avatar.svelte-yw252a.svelte-yw252a{height:48px;width:48px;border-radius:50%;background:url(\"https://pointai.tech/widget/assets/avatar.png\")\n\t\t\tno-repeat center;background-size:60%;border:solid 2px white}.avatar.svelte-yw252a.svelte-yw252a::after{content:\"\";height:9px;width:9px;display:block;border-radius:50%;background-color:#4bff2e;margin-left:35px;margin-top:35px;border:solid #3478ff 2.5px}.language-picker.svelte-yw252a.svelte-yw252a{position:absolute;top:12px;right:12px;transition:300ms ease-in-out}.language-select.svelte-yw252a.svelte-yw252a{margin-top:60px;border-radius:12px;background-color:white;box-shadow:0px 4px 12px rgba(35, 57, 90, 0.15);color:#1b2c45;transition:scale 100ms ease-in-out;padding:4px;transform-origin:top right}.language-picker.svelte-yw252a>.language-select.svelte-yw252a{scale:0}.language-picker.svelte-yw252a:hover>.language-select.svelte-yw252a{scale:1}.selected-language.svelte-yw252a.svelte-yw252a{background-color:#7ea9ff;border-radius:12px;padding:8px 12px;font-size:24px;float:right}.language-select.svelte-yw252a>div.svelte-yw252a{padding:12px 20px;word-spacing:4px;border-radius:10px;cursor:pointer}.language-select.svelte-yw252a>div.svelte-yw252a:hover{background-color:#e5e5e5}.greeting.svelte-yw252a.svelte-yw252a{position:fixed;box-sizing:border-box;bottom:calc(var(--offsetY) + 5px);right:calc(var(--offsetX) + 80px);background-color:white;border:solid #3478ff 3px;padding:12px;border-radius:12px 12px 4px 12px}.greeting.svelte-yw252a p.svelte-yw252a{margin:0px;font-size:14px}.greeting.svelte-yw252a p.svelte-yw252a:last-child{font-weight:600}@media(max-width: 768px){main.svelte-yw252a.svelte-yw252a{right:var(--offsetX);bottom:var(--offsetY)}.chat.svelte-yw252a.svelte-yw252a{height:calc(100vh - var(--offsetY) - 100px);width:calc(100vw - var(--offsetX) - 16px)}.button.svelte-yw252a.svelte-yw252a{height:64px;width:64px}.button.svelte-yw252a img.svelte-yw252a{height:40px}.indicator.svelte-yw252a.svelte-yw252a{height:9px;width:9px;bottom:3.5px;right:3.5px;border:solid #3478ff 2.5px}.greeting.svelte-yw252a.svelte-yw252a{bottom:calc(var(--offsetY) + 3px);right:calc(var(--offsetX) + 72px)}}.footer.svelte-yw252a.svelte-yw252a{font-size:11.5px;color:#999999;text-align:center;width:100%;bottom:100px;margin:0px}.footer.svelte-yw252a a.svelte-yw252a{color:#3478ff;text-decoration:none}");
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[21] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	return child_ctx;
    }

    // (172:1) {#if open}
    function create_if_block_3(ctx) {
    	let div6;
    	let div3;
    	let div1;
    	let div0;
    	let t0;
    	let t1;
    	let t2;
    	let div2;
    	let div3_class_value;
    	let t3;
    	let div4;
    	let t4;
    	let form;
    	let div5;
    	let input;
    	let t5;
    	let button;
    	let t6;
    	let p;
    	let div6_transition;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*messages*/ ctx[5] && /*messages*/ ctx[5].length !== 0 && create_if_block_7(ctx);
    	let if_block1 = (!/*messages*/ ctx[5] || /*messages*/ ctx[5].length === 0) && create_if_block_6(ctx);

    	function select_block_type(ctx, dirty) {
    		if (/*languages*/ ctx[7]) return create_if_block_5;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block2 = current_block_type(ctx);
    	let if_block3 = /*messages*/ ctx[5] && /*messages*/ ctx[5].length !== 0 && create_if_block_4(ctx);

    	return {
    		c() {
    			div6 = element("div");
    			div3 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			div2 = element("div");
    			if_block2.c();
    			t3 = space();
    			div4 = element("div");
    			if (if_block3) if_block3.c();
    			t4 = space();
    			form = element("form");
    			div5 = element("div");
    			input = element("input");
    			t5 = space();
    			button = element("button");
    			t6 = space();
    			p = element("p");
    			p.innerHTML = `Powered by <a href="https://pointai.tech" class="svelte-yw252a">PointAI</a>`;
    			attr(div0, "class", "avatar svelte-yw252a");
    			attr(div1, "class", "avatar-wrapper svelte-yw252a");
    			attr(div2, "class", "language-picker svelte-yw252a");

    			attr(div3, "class", div3_class_value = "appbar " + (!/*messages*/ ctx[5] || /*messages*/ ctx[5].length === 0
    			? 'appbar-open'
    			: '') + " svelte-yw252a");

    			attr(div4, "id", "content");
    			attr(div4, "class", "content svelte-yw252a");
    			attr(input, "type", "text");
    			attr(input, "placeholder", "Type here");
    			attr(input, "class", "svelte-yw252a");
    			attr(button, "type", "button");
    			attr(button, "class", "svelte-yw252a");
    			attr(div5, "class", "svelte-yw252a");
    			attr(p, "class", "footer svelte-yw252a");
    			attr(form, "class", "text-field svelte-yw252a");
    			attr(div6, "class", "chat shadow svelte-yw252a");
    		},
    		m(target, anchor) {
    			insert(target, div6, anchor);
    			append(div6, div3);
    			append(div3, div1);
    			append(div1, div0);
    			append(div1, t0);
    			if (if_block0) if_block0.m(div1, null);
    			append(div3, t1);
    			if (if_block1) if_block1.m(div3, null);
    			append(div3, t2);
    			append(div3, div2);
    			if_block2.m(div2, null);
    			append(div6, t3);
    			append(div6, div4);
    			if (if_block3) if_block3.m(div4, null);
    			append(div6, t4);
    			append(div6, form);
    			append(form, div5);
    			append(div5, input);
    			set_input_value(input, /*textFieldValue*/ ctx[9]);
    			append(div5, t5);
    			append(div5, button);
    			append(form, t6);
    			append(form, p);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler*/ ctx[19]),
    					listen(button, "click", /*sendMessage*/ ctx[11]),
    					listen(form, "submit", prevent_default(/*sendMessage*/ ctx[11]))
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (/*messages*/ ctx[5] && /*messages*/ ctx[5].length !== 0) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_7(ctx);
    					if_block0.c();
    					if_block0.m(div1, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (!/*messages*/ ctx[5] || /*messages*/ ctx[5].length === 0) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_6(ctx);
    					if_block1.c();
    					if_block1.m(div3, t2);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(div2, null);
    				}
    			}

    			if (!current || dirty & /*messages*/ 32 && div3_class_value !== (div3_class_value = "appbar " + (!/*messages*/ ctx[5] || /*messages*/ ctx[5].length === 0
    			? 'appbar-open'
    			: '') + " svelte-yw252a")) {
    				attr(div3, "class", div3_class_value);
    			}

    			if (/*messages*/ ctx[5] && /*messages*/ ctx[5].length !== 0) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_4(ctx);
    					if_block3.c();
    					if_block3.m(div4, null);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (dirty & /*textFieldValue*/ 512 && input.value !== /*textFieldValue*/ ctx[9]) {
    				set_input_value(input, /*textFieldValue*/ ctx[9]);
    			}
    		},
    		i(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!current) return;
    				if (!div6_transition) div6_transition = create_bidirectional_transition(div6, scaleUp, {}, true);
    				div6_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			if (!div6_transition) div6_transition = create_bidirectional_transition(div6, scaleUp, {}, false);
    			div6_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div6);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if_block2.d();
    			if (if_block3) if_block3.d();
    			if (detaching && div6_transition) div6_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (181:5) {#if messages && messages.length !== 0}
    function create_if_block_7(ctx) {
    	let div;
    	let p0;
    	let t0;
    	let t1;
    	let p1;

    	return {
    		c() {
    			div = element("div");
    			p0 = element("p");
    			t0 = text(/*botName*/ ctx[8]);
    			t1 = space();
    			p1 = element("p");
    			p1.textContent = "Online";
    			attr(p0, "class", "svelte-yw252a");
    			attr(p1, "class", "avatar-subtitle svelte-yw252a");
    			attr(div, "class", "avatar-title-closed svelte-yw252a");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, p0);
    			append(p0, t0);
    			append(div, t1);
    			append(div, p1);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*botName*/ 256) set_data(t0, /*botName*/ ctx[8]);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (188:4) {#if !messages || messages.length === 0}
    function create_if_block_6(ctx) {
    	let p0;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let p1;

    	return {
    		c() {
    			p0 = element("p");
    			t0 = text("Hey, I'm ");
    			t1 = text(/*botName*/ ctx[8]);
    			t2 = text("!");
    			t3 = space();
    			p1 = element("p");
    			p1.innerHTML = `You can text me something<br/>and I will answer you`;
    			attr(p0, "class", "title svelte-yw252a");
    			attr(p1, "class", "subtitle svelte-yw252a");
    		},
    		m(target, anchor) {
    			insert(target, p0, anchor);
    			append(p0, t0);
    			append(p0, t1);
    			append(p0, t2);
    			insert(target, t3, anchor);
    			insert(target, p1, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*botName*/ 256) set_data(t1, /*botName*/ ctx[8]);
    		},
    		d(detaching) {
    			if (detaching) detach(p0);
    			if (detaching) detach(t3);
    			if (detaching) detach(p1);
    		}
    	};
    }

    // (219:5) {:else}
    function create_else_block_1(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			div.textContent = "🏳️";
    			attr(div, "class", "selected-language svelte-yw252a");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (195:5) {#if languages}
    function create_if_block_5(ctx) {
    	let div0;
    	let t0_value = /*func*/ ctx[16]().flag + "";
    	let t0;
    	let t1;
    	let div1;
    	let each_value_1 = /*languages*/ ctx[7];
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	return {
    		c() {
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(div0, "class", "selected-language svelte-yw252a");
    			attr(div1, "class", "language-select svelte-yw252a");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			append(div0, t0);
    			insert(target, t1, anchor);
    			insert(target, div1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div1, null);
    				}
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*chatLanguage, languages*/ 192 && t0_value !== (t0_value = /*func*/ ctx[16]().flag + "")) set_data(t0, t0_value);

    			if (dirty & /*changeChatLanguage, languages*/ 4224) {
    				each_value_1 = /*languages*/ ctx[7];
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t1);
    			if (detaching) detach(div1);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    // (206:7) {#each languages as language}
    function create_each_block_1(ctx) {
    	let div;
    	let t0_value = /*language*/ ctx[0].flag + "";
    	let t0;
    	let t1;
    	let t2_value = /*language*/ ctx[0].name + "";
    	let t2;
    	let t3;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[17](/*language*/ ctx[0]);
    	}

    	function keypress_handler() {
    		return /*keypress_handler*/ ctx[18](/*language*/ ctx[0]);
    	}

    	return {
    		c() {
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();
    			attr(div, "class", "language svelte-yw252a");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, t0);
    			append(div, t1);
    			append(div, t2);
    			append(div, t3);

    			if (!mounted) {
    				dispose = [
    					listen(div, "click", click_handler),
    					listen(div, "keypress", keypress_handler)
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*languages*/ 128 && t0_value !== (t0_value = /*language*/ ctx[0].flag + "")) set_data(t0, t0_value);
    			if (dirty & /*languages*/ 128 && t2_value !== (t2_value = /*language*/ ctx[0].name + "")) set_data(t2, t2_value);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (225:4) {#if messages && messages.length !== 0}
    function create_if_block_4(ctx) {
    	let br0;
    	let t0;
    	let t1;
    	let br1;
    	let each_value = /*messages*/ ctx[5];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			br0 = element("br");
    			t0 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t1 = space();
    			br1 = element("br");
    		},
    		m(target, anchor) {
    			insert(target, br0, anchor);
    			insert(target, t0, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert(target, t1, anchor);
    			insert(target, br1, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*messages, formatTextWithLink*/ 32) {
    				each_value = /*messages*/ ctx[5];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(t1.parentNode, t1);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(br0);
    			if (detaching) detach(t0);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(t1);
    			if (detaching) detach(br1);
    		}
    	};
    }

    // (227:5) {#each messages as message}
    function create_each_block(ctx) {
    	let div;
    	let raw_value = formatTextWithLink(/*message*/ ctx[21].text, /*message*/ ctx[21].fromUser) + "";
    	let div_class_value;

    	return {
    		c() {
    			div = element("div");

    			attr(div, "class", div_class_value = "message " + (/*message*/ ctx[21].fromUser
    			? 'message-user'
    			: 'message-bot') + " svelte-yw252a");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			div.innerHTML = raw_value;
    		},
    		p(ctx, dirty) {
    			if (dirty & /*messages*/ 32 && raw_value !== (raw_value = formatTextWithLink(/*message*/ ctx[21].text, /*message*/ ctx[21].fromUser) + "")) div.innerHTML = raw_value;
    			if (dirty & /*messages*/ 32 && div_class_value !== (div_class_value = "message " + (/*message*/ ctx[21].fromUser
    			? 'message-user'
    			: 'message-bot') + " svelte-yw252a")) {
    				attr(div, "class", div_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (258:1) {#if showGreeting}
    function create_if_block_2(ctx) {
    	let div;
    	let div_transition;
    	let current;

    	return {
    		c() {
    			div = element("div");

    			div.innerHTML = `<p class="svelte-yw252a">Hey there!</p> 
			<p class="svelte-yw252a">How can I help?</p>`;

    			attr(div, "class", "greeting svelte-yw252a");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			current = true;
    		},
    		i(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!current) return;
    				if (!div_transition) div_transition = create_bidirectional_transition(div, scaleUp, {}, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, scaleUp, {}, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};
    }

    // (266:2) {#if !open}
    function create_if_block_1(ctx) {
    	let div;
    	let div_transition;
    	let current;

    	return {
    		c() {
    			div = element("div");
    			attr(div, "class", "indicator svelte-yw252a");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			current = true;
    		},
    		i(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!current) return;
    				if (!div_transition) div_transition = create_bidirectional_transition(div, scale, { duration: 200 }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, scale, { duration: 200 }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};
    }

    // (275:2) {:else}
    function create_else_block(ctx) {
    	let img;
    	let img_src_value;
    	let img_transition;
    	let current;

    	return {
    		c() {
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "https://pointai.tech/widget/assets/down.svg")) attr(img, "src", img_src_value);
    			attr(img, "alt", "Close widget");
    			attr(img, "class", "svelte-yw252a");
    		},
    		m(target, anchor) {
    			insert(target, img, anchor);
    			current = true;
    		},
    		i(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!current) return;
    				if (!img_transition) img_transition = create_bidirectional_transition(img, scale, { duration: 200 }, true);
    				img_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			if (!img_transition) img_transition = create_bidirectional_transition(img, scale, { duration: 200 }, false);
    			img_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(img);
    			if (detaching && img_transition) img_transition.end();
    		}
    	};
    }

    // (269:2) {#if !open}
    function create_if_block(ctx) {
    	let img;
    	let img_src_value;
    	let img_transition;
    	let current;

    	return {
    		c() {
    			img = element("img");
    			if (!src_url_equal(img.src, img_src_value = "https://pointai.tech/widget/assets/avatar.png")) attr(img, "src", img_src_value);
    			attr(img, "alt", "PointAI Logo");
    			attr(img, "class", "svelte-yw252a");
    		},
    		m(target, anchor) {
    			insert(target, img, anchor);
    			current = true;
    		},
    		i(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!current) return;
    				if (!img_transition) img_transition = create_bidirectional_transition(img, scale, { duration: 200 }, true);
    				img_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			if (!img_transition) img_transition = create_bidirectional_transition(img, scale, { duration: 200 }, false);
    			img_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(img);
    			if (detaching && img_transition) img_transition.end();
    		}
    	};
    }

    function create_fragment(ctx) {
    	let main;
    	let t0;
    	let t1;
    	let div;
    	let t2;
    	let current_block_type_index;
    	let if_block3;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*open*/ ctx[3] && create_if_block_3(ctx);
    	let if_block1 = /*showGreeting*/ ctx[4] && create_if_block_2();
    	let if_block2 = !/*open*/ ctx[3] && create_if_block_1();
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (!/*open*/ ctx[3]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block3 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			main = element("main");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			div = element("div");
    			if (if_block2) if_block2.c();
    			t2 = space();
    			if_block3.c();
    			attr(div, "class", "button shadow svelte-yw252a");
    			set_style(main, "--offsetX", /*offsetX*/ ctx[1]);
    			set_style(main, "--offsetY", /*offsetY*/ ctx[2]);
    			attr(main, "class", "svelte-yw252a");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			if (if_block0) if_block0.m(main, null);
    			append(main, t0);
    			if (if_block1) if_block1.m(main, null);
    			append(main, t1);
    			append(main, div);
    			if (if_block2) if_block2.m(div, null);
    			append(div, t2);
    			if_blocks[current_block_type_index].m(div, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(div, "click", /*toggle*/ ctx[10]),
    					listen(div, "keypress", /*toggle*/ ctx[10])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (/*open*/ ctx[3]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*open*/ 8) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_3(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(main, t0);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*showGreeting*/ ctx[4]) {
    				if (if_block1) {
    					if (dirty & /*showGreeting*/ 16) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_2();
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(main, t1);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (!/*open*/ ctx[3]) {
    				if (if_block2) {
    					if (dirty & /*open*/ 8) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_1();
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(div, t2);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx);

    			if (current_block_type_index !== previous_block_index) {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block3 = if_blocks[current_block_type_index];

    				if (!if_block3) {
    					if_block3 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block3.c();
    				}

    				transition_in(if_block3, 1);
    				if_block3.m(div, null);
    			}

    			if (!current || dirty & /*offsetX*/ 2) {
    				set_style(main, "--offsetX", /*offsetX*/ ctx[1]);
    			}

    			if (!current || dirty & /*offsetY*/ 4) {
    				set_style(main, "--offsetY", /*offsetY*/ ctx[2]);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			transition_in(if_block3);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			transition_out(if_block3);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(main);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if_blocks[current_block_type_index].d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function formatTextWithLink(text, fromUser) {
    	const words = text.split(" ");

    	const formattedWords = words.map(word => {
    		if (word.startsWith("http://") || word.startsWith("https://")) {
    			return `<a href="${word.replace(/\.$/, "")}" target="_blank" style="color: #${fromUser ? "fff" : "3478ff"}">${word}</a>`;
    		} else {
    			return word;
    		}
    	});

    	return formattedWords.join(" ");
    }

    function instance($$self, $$props, $$invalidate) {
    	let { userId } = $$props;
    	let { clientName } = $$props;
    	let { offset } = $$props;
    	let offsetX, offsetY;
    	if (offset) [offsetX, offsetY] = offset.split(";"); else [offsetX, offsetY] = ["16px", "16px"];
    	let { language } = $$props;
    	console.log(offsetX, offsetY);
    	let open = false;
    	let showGreeting = false;

    	const toggle = () => {
    		$$invalidate(3, open = !open);
    		$$invalidate(4, showGreeting = false);

    		if (!open && messages && messages.length === 0) {
    			setTimeout(
    				() => {
    					if (!open) $$invalidate(4, showGreeting = true);
    				},
    				5000
    			);
    		}
    	};

    	/**
     * @type {string}
     */
    	let chatId;

    	/**
     * @type Array<import("./utils/storage").Message>
     */
    	let messages;

    	/**
     * @type {string}
     */
    	let chatLanguage;

    	/**
     * @type {Array<any>}
     */
    	let languages;

    	let botName;

    	onMount(async () => {
    		const chat = await getChat(userId, language);
    		chatId = chat.id;
    		$$invalidate(6, chatLanguage = chat.language);
    		$$invalidate(5, messages = chat.messages);
    		$$invalidate(8, botName = name());
    		$$invalidate(7, languages = await getLanguages(userId));

    		setTimeout(
    			() => {
    				$$invalidate(4, showGreeting = true);
    			},
    			500
    		);
    	});

    	let textFieldValue;

    	const sendMessage = async () => {
    		if (!textFieldValue || chatId == null) return;
    		const chatContainer = document.getElementById("content");

    		const messageId = messages.length === 0
    		? 1
    		: messages[messages.length - 1].id + 1;

    		const message = {
    			id: messageId,
    			text: textFieldValue,
    			timestamp: Date.now(),
    			fromUser: true
    		};

    		$$invalidate(5, messages = [message, ...messages]);
    		chatContainer.scrollTo(0, chatContainer.scrollHeight);
    		$$invalidate(9, textFieldValue = "");
    		const response = await send(userId, chatId, message, clientName ?? "Anonymous");

    		const responseMessage = {
    			id: messageId + 1,
    			text: response,
    			timestamp: Date.now(),
    			fromUser: false
    		};

    		$$invalidate(5, messages = [responseMessage, ...messages]);
    		chatContainer.scrollTo(0, chatContainer.scrollHeight);

    		saveChat({
    			id: chatId,
    			language: chatLanguage,
    			messages
    		});
    	};

    	/**
     * Change Language of the chat
     * @param {string} languageCode
     */
    	const changeChatLanguage = async languageCode => {
    		try {
    			if (!messages) return;
    			const greeting = await changeLanguage(userId, chatId, userId, languageCode);
    			$$invalidate(6, chatLanguage = languageCode);

    			$$invalidate(5, messages = [
    				{
    					id: messages[messages.length - 1].id + 1,
    					text: greeting,
    					timestamp: Date.now(),
    					fromUser: false
    				},
    				...messages
    			]);

    			saveChat({
    				id: chatId,
    				language: chatLanguage,
    				messages
    			});
    		} catch(err) {
    			console.error(err);
    		}
    	};

    	const func = () => {
    		let lang = chatLanguage ?? languages[0].code;

    		return languages.find(l => {
    			return l.code === lang;
    		});
    	};

    	const click_handler = language => changeChatLanguage(language.code);
    	const keypress_handler = language => changeChatLanguage(language.code);

    	function input_input_handler() {
    		textFieldValue = this.value;
    		$$invalidate(9, textFieldValue);
    	}

    	$$self.$$set = $$props => {
    		if ('userId' in $$props) $$invalidate(13, userId = $$props.userId);
    		if ('clientName' in $$props) $$invalidate(14, clientName = $$props.clientName);
    		if ('offset' in $$props) $$invalidate(15, offset = $$props.offset);
    		if ('language' in $$props) $$invalidate(0, language = $$props.language);
    	};

    	return [
    		language,
    		offsetX,
    		offsetY,
    		open,
    		showGreeting,
    		messages,
    		chatLanguage,
    		languages,
    		botName,
    		textFieldValue,
    		toggle,
    		sendMessage,
    		changeChatLanguage,
    		userId,
    		clientName,
    		offset,
    		func,
    		click_handler,
    		keypress_handler,
    		input_input_handler
    	];
    }

    class Widget extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(
    			this,
    			options,
    			instance,
    			create_fragment,
    			safe_not_equal,
    			{
    				userId: 13,
    				clientName: 14,
    				offset: 15,
    				language: 0
    			},
    			add_css
    		);
    	}
    }

    const div = document.createElement('div');
    const script = document.currentScript;

    script.parentNode.insertBefore(div, script);

    new Widget({
        target: div,
        props: {
            userId: script.getAttribute('data-user-id'),
            clientName: script.getAttribute('data-client-name'),
            offset: script.getAttribute('data-offset'),
            language: script.getAttribute('data-language'),
        }
    });

})();
