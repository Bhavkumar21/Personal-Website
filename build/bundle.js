
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
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
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }
    function set_store_value(store, ret, value) {
        store.set(value);
        return ret;
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
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
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
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
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

    let current_component;
    function set_current_component(component) {
        current_component = component;
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
    const outroing = new Set();
    let outros;
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
    function create_component(block) {
        block && block.c();
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
    function init$1(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
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

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=} start
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0 && stop) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    function is_date(obj) {
        return Object.prototype.toString.call(obj) === '[object Date]';
    }

    function tick_spring(ctx, last_value, current_value, target_value) {
        if (typeof current_value === 'number' || is_date(current_value)) {
            // @ts-ignore
            const delta = target_value - current_value;
            // @ts-ignore
            const velocity = (current_value - last_value) / (ctx.dt || 1 / 60); // guard div by 0
            const spring = ctx.opts.stiffness * delta;
            const damper = ctx.opts.damping * velocity;
            const acceleration = (spring - damper) * ctx.inv_mass;
            const d = (velocity + acceleration) * ctx.dt;
            if (Math.abs(d) < ctx.opts.precision && Math.abs(delta) < ctx.opts.precision) {
                return target_value; // settled
            }
            else {
                ctx.settled = false; // signal loop to keep ticking
                // @ts-ignore
                return is_date(current_value) ?
                    new Date(current_value.getTime() + d) : current_value + d;
            }
        }
        else if (Array.isArray(current_value)) {
            // @ts-ignore
            return current_value.map((_, i) => tick_spring(ctx, last_value[i], current_value[i], target_value[i]));
        }
        else if (typeof current_value === 'object') {
            const next_value = {};
            for (const k in current_value) {
                // @ts-ignore
                next_value[k] = tick_spring(ctx, last_value[k], current_value[k], target_value[k]);
            }
            // @ts-ignore
            return next_value;
        }
        else {
            throw new Error(`Cannot spring ${typeof current_value} values`);
        }
    }
    function spring(value, opts = {}) {
        const store = writable(value);
        const { stiffness = 0.15, damping = 0.8, precision = 0.01 } = opts;
        let last_time;
        let task;
        let current_token;
        let last_value = value;
        let target_value = value;
        let inv_mass = 1;
        let inv_mass_recovery_rate = 0;
        let cancel_task = false;
        function set(new_value, opts = {}) {
            target_value = new_value;
            const token = current_token = {};
            if (value == null || opts.hard || (spring.stiffness >= 1 && spring.damping >= 1)) {
                cancel_task = true; // cancel any running animation
                last_time = now();
                last_value = new_value;
                store.set(value = target_value);
                return Promise.resolve();
            }
            else if (opts.soft) {
                const rate = opts.soft === true ? .5 : +opts.soft;
                inv_mass_recovery_rate = 1 / (rate * 60);
                inv_mass = 0; // infinite mass, unaffected by spring forces
            }
            if (!task) {
                last_time = now();
                cancel_task = false;
                task = loop(now => {
                    if (cancel_task) {
                        cancel_task = false;
                        task = null;
                        return false;
                    }
                    inv_mass = Math.min(inv_mass + inv_mass_recovery_rate, 1);
                    const ctx = {
                        inv_mass,
                        opts: spring,
                        settled: true,
                        dt: (now - last_time) * 60 / 1000
                    };
                    const next_value = tick_spring(ctx, last_value, value, target_value);
                    last_time = now;
                    last_value = value;
                    store.set(value = next_value);
                    if (ctx.settled) {
                        task = null;
                    }
                    return !ctx.settled;
                });
            }
            return new Promise(fulfil => {
                task.promise.then(() => {
                    if (token === current_token)
                        fulfil();
                });
            });
        }
        const spring = {
            set,
            update: (fn, opts) => set(fn(target_value, value), opts),
            subscribe: store.subscribe,
            stiffness,
            damping,
            precision
        };
        return spring;
    }

    // Arguably we should make a difference between point / vector
    // but it's hard to make TypeScript distinguish without creating
    // separate classes which (probably?) adds some pointless perf.
    // overhead
    function plus(p, q) {
        return {
            x: p.x + q.x,
            y: p.y + q.y
        };
    }
    function scale(p, d) {
        return {
            x: p.x * d,
            y: p.y * d
        };
    }
    function minus(p, q) {
        return plus(p, scale(q, -1));
    }
    function rotate(p, rads) {
        const cos = Math.cos(rads);
        const sin = Math.sin(rads);
        return {
            x: cos * p.x - sin * p.y,
            y: sin * p.x + cos * p.y
        };
    }
    function interpolate(a, b, t = 0.5) {
        return plus(a, scale(minus(b, a), t));
    }
    function magnitude(p) {
        return Math.sqrt(p.x * p.x + p.y * p.y);
    }
    function normal(p) {
        return { x: p.y, y: -p.x };
    }
    function unit(p) {
        return scale(p, 1 / magnitude(p));
    }
    function moveTowards(from, to, distance) {
        return plus(from, scale(unit(minus(to, from)), distance));
    }
    function angleTo(u, v) {
        let angle = Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y);
        if (angle > Math.PI)
            angle -= 2 * Math.PI;
        if (angle < -Math.PI)
            angle += 2 * Math.PI;
        return angle;
    }
    function dot(p, q) {
        return p.x * q.x + q.y * p.y;
    }
    function projectOnto(p, v) {
        return scale(v, dot(p, v) / (v.x * v.x + v.y * v.y));
    }
    function mirror(p, around1, around2) {
        const v = minus(p, around1);
        const l = minus(around2, around1);
        const d = projectOnto(v, l);
        return plus(p, (scale(minus(d, v), 2)));
    }

    function centroid(ps) {
        return scale(ps.reduce(plus, { x: 0, y: 0 }), 1 / ps.length);
    }
    function getOrientation(p, q, r) {
        const u = minus(q, r);
        const v = minus(p, q);
        return Math.sign(u.x * v.y - u.y * v.x);
    }
    function createSmoothControlPoints(p, q, r, d = 0.4) {
        const cp_1 = plus(q, scale(minus(p, r), d));
        const cp_2 = plus(q, (scale(minus(r, p), d)));
        return [cp_1, cp_2, r];
    }
    function clamp(lb, x, ub) {
        return Math.max(lb, Math.min(x, ub));
    }

    const CLOCKWISE = 1;
    const COUNTER_CLOCKWISE = -1;
    function init(s, parent = null) {
        const newS = Object.assign(Object.assign({}, s), { location: s.location || { x: 0, y: 0 }, children: [], parent });
        newS.children =
            (s.children || []).map(c => init(c, newS));
        return newS;
    }
    const ITERATIONS = 100;
    function runRotationConstraints(current, parent, rotationConstraints) {
        let result = current;
        if (rotationConstraints.length > 1) {
            throw new Error('Too hard!');
        }
        if (rotationConstraints.length === 1) {
            let { child: grandChild, min, max } = rotationConstraints[0];
            const joint = minus(parent, grandChild);
            const diff = minus(result, parent);
            const a = -angleTo(diff, joint);
            if (a < min) {
                result = plus(parent, rotate(joint, min));
            }
            if (a > max) {
                result =
                    plus(parent, rotate(joint, max));
            }
        }
        return result;
    }
    function runDistanceConstraint(s, node, distance) {
        if (distance === void 0) {
            return node;
        }
        const target = s.target || s.location;
        let diff = minus(node, target);
        if (magnitude(diff) === 0) {
            diff =
                { x: Math.random(), y: Math.random() };
        }
        return plus(target, scale(diff, distance / magnitude(diff)));
    }
    function runOrientationConstraint(node, child, parentLocation) {
        if (!child.orientationConstraint) {
            return node;
        }
        const orientation = getOrientation(child.location, node, parentLocation);
        if (orientation === -child.orientationConstraint) {
            return mirror(node, parentLocation, child.location);
        }
        return node;
    }
    function FABRIK(s, iterations = ITERATIONS) {
        let result = s;
        for (let i = 0; i < iterations; i++) {
            FABRIK_SINGLE(result);
        }
        return result;
    }
    function FABRIK_SINGLE(s) {
        const result = s;
        FABRIK_FORWARDS(result);
        result.location =
            result.target || result.location;
        FABRIK_BACKWARDS(result);
        return result;
    }
    function FABRIK_FORWARDS(s) {
        const suggestions = [];
        const target = s.target || s.location;
        const current = target || { x: 0, y: 0 };
        for (const child of s.children) {
            FABRIK_FORWARDS(child);
            if (!target) {
                continue;
            }
            let suggestedParentPos = s.location;
            suggestedParentPos = runDistanceConstraint(child, s.location, child.distanceConstraint);
            if (s.parent) {
                suggestedParentPos = runOrientationConstraint(suggestedParentPos, child, s.parent.location);
            }
            suggestions.push(suggestedParentPos);
        }
        const location = suggestions.length
            ? centroid(suggestions)
            : current;
        s.location = location;
    }
    function FABRIK_BACKWARDS(s, parent = null) {
        s.children.forEach(child => {
            const rotationConstraint = [];
            if (child.rotationConstraint) {
                rotationConstraint.push({
                    child: parent.location,
                    min: child.rotationConstraint[0],
                    max: child.rotationConstraint[1],
                });
            }
            if (child.globalRotationConstraint) {
                rotationConstraint.push({
                    child: plus(s.location, { x: -1, y: 0 }),
                    min: child.globalRotationConstraint[0],
                    max: child.globalRotationConstraint[1],
                });
            }
            child.location = runRotationConstraints(child.location, s.target || s.location, rotationConstraint);
            child.location = runDistanceConstraint(s, child.location, child.distanceConstraint);
            child.location = runOrientationConstraint(child.location, child, s.location);
            FABRIK_BACKWARDS(child, s);
        });
    }
    function mkLimbs(s) {
        const result = {};
        for (const l of s.children.map(mkLimbs)) {
            for (const n of Object.keys(l)) {
                result[n] = result[n] || [];
                result[n] = [...result[n], ...l[n]];
            }
        }
        for (const n of s.names) {
            result[n] = result[n] || [];
            result[n] = [...result[n], s.location];
        }
        return result;
    }

    const HEAD_LENGTH = 350;
    const PELVIS = {
        x: (2 * -3750 + 9140) / 2,
        y: (3107 - 300 - 300) / 2 + 100,
    };
    const excited = {
        TORSO: { x: 0, y: -100 },
        HAND_L: { x: -600, y: -600 },
        HAND_R: { x: 500, y: -700 },
        LEG_L: { x: -400, y: 1400 },
        LEG_R: { x: 200, y: 1400 },
        HAND_ORIENTATION_L: CLOCKWISE,
        HAND_ORIENTATION_R: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_L: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_R: CLOCKWISE,
        HEAD: { x: 5, y: -10 },
        ON_FLOOR_L: true,
        ON_FLOOR_R: true
    };
    const look = {
        TORSO: { x: 70, y: -200 },
        HAND_L: { x: -400, y: 200 },
        HAND_R: { x: 500, y: 200 },
        LEG_L: { x: -400, y: 1400 },
        LEG_R: { x: 200, y: 1400 },
        HAND_ORIENTATION_L: COUNTER_CLOCKWISE,
        HAND_ORIENTATION_R: CLOCKWISE,
        LEG_ORIENTATION_L: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_R: CLOCKWISE,
        HEAD: { x: 50, y: -50 },
        ON_FLOOR_L: true,
        ON_FLOOR_R: true
    };
    const wave = {
        TORSO: { x: 0, y: -300 },
        HAND_L: { x: -520, y: 150 },
        HAND_R: { x: 1000, y: -1200 },
        LEG_L: { x: -400, y: 1400 },
        LEG_R: { x: 200, y: 1400 },
        HAND_ORIENTATION_L: COUNTER_CLOCKWISE,
        HAND_ORIENTATION_R: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_L: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_R: CLOCKWISE,
        HEAD: { x: 5, y: -10 },
        ON_FLOOR_L: true,
        ON_FLOOR_R: true
    };
    const squat = {
        TORSO: { x: 0, y: 400 },
        HAND_L: { x: -720, y: -550 },
        HAND_R: { x: 800, y: -700 },
        LEG_L: { x: -200, y: 1400 },
        LEG_R: { x: 200, y: 1400 },
        HAND_ORIENTATION_L: CLOCKWISE,
        HAND_ORIENTATION_R: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_L: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_R: CLOCKWISE,
        HEAD: { x: 0, y: -45 },
        ON_FLOOR_L: true,
        ON_FLOOR_R: true,
    };
    const guitar = {
        TORSO: { x: -600, y: 600 },
        HAND_L: { x: -650, y: 650 },
        HAND_R: { x: 800, y: -250 },
        LEG_L: { x: -300, y: 1400 },
        LEG_R: { x: 300, y: 1400 },
        HAND_ORIENTATION_L: COUNTER_CLOCKWISE,
        HAND_ORIENTATION_R: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_L: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_R: COUNTER_CLOCKWISE,
        HEAD: { x: -20, y: 40 },
        ON_FLOOR_L: false,
        ON_FLOOR_R: false,
    };
    const box = {
        TORSO: { x: 100, y: 100 },
        HAND_L: { x: 600, y: -550 },
        HAND_R: { x: 800, y: -450 },
        LEG_L: { x: -400, y: 1400 },
        LEG_R: { x: 200, y: 1400 },
        HAND_ORIENTATION_L: COUNTER_CLOCKWISE,
        HAND_ORIENTATION_R: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_L: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_R: CLOCKWISE,
        HEAD: { x: 70, y: 0 },
        ON_FLOOR_L: true,
        ON_FLOOR_R: true,
    };
    const reach_l = {
        TORSO: { x: -400, y: -100 },
        HAND_L: { x: -1450, y: -1450 },
        HAND_R: { x: 0, y: -1000 },
        LEG_L: { x: -400, y: 1400 },
        LEG_R: { x: 200, y: 1400 },
        HAND_ORIENTATION_L: CLOCKWISE,
        HAND_ORIENTATION_R: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_L: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_R: CLOCKWISE,
        HEAD: { x: 0, y: -50 },
        ON_FLOOR_L: true,
        ON_FLOOR_R: true,
    };
    const serio = {
        TORSO: { x: -202.4421593830332, y: 219.76478149100262 },
        HAND_L: { x: -364.39588688945986, y: 79.40488431876611 },
        HAND_R: { x: -537.1465295629818, y: 127.99100257069426 },
        LEG_L: { x: -400, y: 1400 },
        LEG_R: { x: 200, y: 1400 },
        HAND_ORIENTATION_L: COUNTER_CLOCKWISE,
        HAND_ORIENTATION_R: CLOCKWISE,
        LEG_ORIENTATION_L: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_R: CLOCKWISE,
        HEAD: { x: -30, y: -10 },
        ON_FLOOR_L: true,
        ON_FLOOR_R: true,
    };
    const reach_r = {
        TORSO: { x: 300, y: -152.72879177377877 },
        HAND_L: { x: -974.4215938303339, y: -665.5822622107969 },
        HAND_R: { x: 660, y: -1540 },
        LEG_L: { x: 260, y: 690 },
        LEG_R: { x: 200, y: 1400 },
        HAND_ORIENTATION_L: CLOCKWISE,
        HAND_ORIENTATION_R: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_L: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_R: CLOCKWISE,
        HEAD: { x: 5, y: 40 },
        ON_FLOOR_L: false,
        ON_FLOOR_R: true,
    };
    const kneel = {
        TORSO: { x: 164.39588688946037, y: 565.2660668380465 },
        HAND_L: { x: -37.78920308483259, y: 624.6491002570697 },
        HAND_R: { x: 458.4832904884322, y: -765.008997429306 },
        LEG_L: { x: -457.04370179948558, y: 1300 },
        LEG_R: { x: 596.0154241645248, y: 1400 },
        HAND_ORIENTATION_L: COUNTER_CLOCKWISE,
        HAND_ORIENTATION_R: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_L: CLOCKWISE,
        LEG_ORIENTATION_R: CLOCKWISE,
        HEAD: { x: 0, y: -40 },
        ON_FLOOR_L: false,
        ON_FLOOR_R: true,
    };
    const on_point = {
        TORSO: { x: 140.35989717223686, y: -255.29948586118235 },
        HAND_L: { x: 3.410605131648481e-13, y: -1599.5154241645243 },
        HAND_R: { x: 302.3136246786635, y: -1583.3200514138816 },
        LEG_L: { x: 162, y: 800 },
        LEG_R: { x: 200, y: 1400 },
        HAND_ORIENTATION_L: CLOCKWISE,
        HAND_ORIENTATION_R: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_L: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_R: CLOCKWISE,
        HEAD: { x: 5, y: -10 },
        ON_FLOOR_L: false,
        ON_FLOOR_R: true,
    };
    const squat2 = {
        TORSO: { x: 21.593830334190557, y: 727.219794344473 },
        HAND_L: { x: -496.6580976863751, y: 1078.1195372750644 },
        HAND_R: { x: 496.65809768637564, y: 1083.517994858612 },
        LEG_L: { x: -539.8457583547555, y: 1400 },
        LEG_R: { x: 637.0179948586122, y: 1400 },
        HAND_ORIENTATION_L: COUNTER_CLOCKWISE,
        HAND_ORIENTATION_R: CLOCKWISE,
        LEG_ORIENTATION_L: COUNTER_CLOCKWISE,
        LEG_ORIENTATION_R: CLOCKWISE,
        HEAD: { x: 0, y: 0 },
        ON_FLOOR_L: true,
        ON_FLOOR_R: true,
    };
    const POSE_LIST = [wave, reach_l, on_point, reach_r, serio, squat, box, guitar, squat2, kneel, excited, look];
    const POSES = POSE_LIST.map(mkPose);
    function mkPose(pose) {
        const rightArm = init({
            names: ['rightArm', 'collar'],
            distanceConstraint: HEAD_LENGTH,
            rotationConstraint: [Math.PI / 2, Math.PI / 2],
            children: [{
                    names: ['rightArm'],
                    distanceConstraint: 1.75 * HEAD_LENGTH,
                    children: [{
                            orientationConstraint: pose.HAND_ORIENTATION_R,
                            target: plus(PELVIS, pose.HAND_R),
                            distanceConstraint: 1.75 * HEAD_LENGTH,
                            names: ['rightArm'],
                        }]
                }]
        });
        const leftArm = init({
            names: ['leftArm', 'collar'],
            distanceConstraint: HEAD_LENGTH,
            rotationConstraint: [-Math.PI / 2, -Math.PI / 2],
            children: [{
                    names: ['leftArm'],
                    distanceConstraint: 1.75 * HEAD_LENGTH,
                    children: [{
                            orientationConstraint: pose.HAND_ORIENTATION_L,
                            target: plus(PELVIS, pose.HAND_L),
                            distanceConstraint: 1.75 * HEAD_LENGTH,
                            names: ['leftArm'],
                        }]
                }]
        });
        const leftLeg = init({
            names: ['leftLeg'],
            distanceConstraint: HEAD_LENGTH * 0.9,
            rotationConstraint: [
                Math.PI / 2 - Math.PI / 7,
                Math.PI / 2 - Math.PI / 7
            ],
            children: [
                {
                    names: ['leftLeg'],
                    distanceConstraint: 1.75 * HEAD_LENGTH,
                    children: [{
                            orientationConstraint: pose.LEG_ORIENTATION_L,
                            distanceConstraint: 2.25 * HEAD_LENGTH,
                            target: plus(PELVIS, pose.LEG_L),
                            names: ['leftLeg'],
                        }]
                },
            ]
        });
        const rightLeg = init({
            names: ['rightLeg'],
            distanceConstraint: HEAD_LENGTH * 0.9,
            rotationConstraint: [
                -Math.PI / 2 + Math.PI / 7,
                -Math.PI / 2 + Math.PI / 7
            ],
            children: [{
                    names: ['rightLeg'],
                    distanceConstraint: 1.75 * HEAD_LENGTH,
                    children: [{
                            orientationConstraint: pose.LEG_ORIENTATION_R,
                            distanceConstraint: 2.25 * HEAD_LENGTH,
                            target: plus(PELVIS, pose.LEG_R),
                            names: ['rightLeg'],
                        }]
                }]
        });
        const torso = init({
            names: ['torso'],
            distanceConstraint: 325,
            globalRotationConstraint: [
                -Math.PI / 2 - Math.PI / 25,
                -Math.PI / 2 + Math.PI / 25,
            ],
        });
        const pelvis = init({
            names: ['pelvis'],
            distanceConstraint: 300,
            globalRotationConstraint: [
                Math.PI / 2 - Math.PI / 15,
                Math.PI / 2 + Math.PI / 15,
            ],
        });
        const root = init({
            names: ['torso'],
            target: plus(PELVIS, pose.TORSO),
            location: { x: 0, y: 0 },
        });
        return {
            pelvis,
            torso,
            leftArm,
            rightHand: rightArm.children[0].children[0],
            leftHand: leftArm.children[0].children[0],
            rightArm,
            leftLeg,
            rightLeg,
            skeleton: FABRIK(Object.assign(Object.assign({}, root), { children: [
                    Object.assign(Object.assign({}, torso), { children: [rightArm, leftArm] }),
                    Object.assign(Object.assign({}, pelvis), { children: [rightLeg, leftLeg] })
                ] }))
        };
    }

    function move(p) {
        return `M ${p.x} ${p.y}`;
    }
    function line(p) {
        return `L ${p.x} ${p.y}`;
    }
    function cubic(p, q, r) {
        return `C ${p.x} ${p.y} ${q.x} ${q.y} ${r.x} ${r.y}`;
    }

    /* src/components/Torso.svelte generated by Svelte v3.59.2 */
    const file$c = "src/components/Torso.svelte";

    function create_fragment$c(ctx) {
    	let g;
    	let path0;
    	let path0_d_value;
    	let path1;
    	let path1_d_value;
    	let use;
    	let path2;
    	let path2_d_value;
    	let rect;
    	let rect_transform_value;
    	let g_transform_value;

    	const block = {
    		c: function create() {
    			g = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			use = svg_element("use");
    			path2 = svg_element("path");
    			rect = svg_element("rect");
    			attr_dev(path0, "d", path0_d_value = "" + (move(/*waist_l*/ ctx[1]) + " " + cubic(...createSmoothControlPoints(/*waist_l*/ ctx[1], /*groin*/ ctx[7], /*waist_r*/ ctx[2]))));
    			attr_dev(path0, "stroke-width", "10");
    			attr_dev(path0, "fill", "var(--green)");
    			add_location(path0, file$c, 46, 2, 1043);
    			attr_dev(path1, "stroke-width", "10");
    			attr_dev(path1, "fill", "var(--blue)");
    			attr_dev(path1, "d", path1_d_value = "M -482.313 56.24 C -540.471 -118.57 -410.346 -299.0 -226.12 -299.0 H 227.07 C 408.98 -299.0 538.84 -122.766 484.96 50.98 L " + /*waist_r*/ ctx[2].x + " " + /*waist_r*/ ctx[2].y + " L " + /*waist_l*/ ctx[1].x + " " + /*waist_l*/ ctx[1].y + " L -482.313 56.24 Z");
    			add_location(path1, file$c, 52, 2, 1190);
    			attr_dev(use, "href", "#torso1");
    			add_location(use, file$c, 58, 2, 1449);
    			attr_dev(path2, "fill", "var(--black)");
    			attr_dev(path2, "d", path2_d_value = "" + (move(/*waist_l*/ ctx[1]) + " " + line(/*waist_r*/ ctx[2]) + " " + line(/*pq*/ ctx[4]) + " " + line(/*pr*/ ctx[3]) + " Z"));
    			add_location(path2, file$c, 60, 2, 1475);
    			attr_dev(rect, "transform", rect_transform_value = "translate(" + /*belt_center*/ ctx[5].x + " " + /*belt_center*/ ctx[5].y + ") rotate(" + -/*lean*/ ctx[6] + ")");
    			attr_dev(rect, "fill", "var(--yellow)");
    			attr_dev(rect, "x", "-90");
    			attr_dev(rect, "y", "-50");
    			attr_dev(rect, "width", "180");
    			attr_dev(rect, "height", "100");
    			attr_dev(rect, "rx", "20");
    			add_location(rect, file$c, 65, 2, 1579);
    			attr_dev(g, "id", "torso_group");
    			attr_dev(g, "transform", g_transform_value = "translate(" + /*torso_p*/ ctx[0].x + " " + /*torso_p*/ ctx[0].y + ") rotate(" + /*lean_torso*/ ctx[8] + ") translate(0 -220)");
    			add_location(g, file$c, 44, 0, 933);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, g, anchor);
    			append_dev(g, path0);
    			append_dev(g, path1);
    			append_dev(g, use);
    			append_dev(g, path2);
    			append_dev(g, rect);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*waist_l, groin, waist_r*/ 134 && path0_d_value !== (path0_d_value = "" + (move(/*waist_l*/ ctx[1]) + " " + cubic(...createSmoothControlPoints(/*waist_l*/ ctx[1], /*groin*/ ctx[7], /*waist_r*/ ctx[2]))))) {
    				attr_dev(path0, "d", path0_d_value);
    			}

    			if (dirty & /*waist_r, waist_l*/ 6 && path1_d_value !== (path1_d_value = "M -482.313 56.24 C -540.471 -118.57 -410.346 -299.0 -226.12 -299.0 H 227.07 C 408.98 -299.0 538.84 -122.766 484.96 50.98 L " + /*waist_r*/ ctx[2].x + " " + /*waist_r*/ ctx[2].y + " L " + /*waist_l*/ ctx[1].x + " " + /*waist_l*/ ctx[1].y + " L -482.313 56.24 Z")) {
    				attr_dev(path1, "d", path1_d_value);
    			}

    			if (dirty & /*waist_l, waist_r, pq, pr*/ 30 && path2_d_value !== (path2_d_value = "" + (move(/*waist_l*/ ctx[1]) + " " + line(/*waist_r*/ ctx[2]) + " " + line(/*pq*/ ctx[4]) + " " + line(/*pr*/ ctx[3]) + " Z"))) {
    				attr_dev(path2, "d", path2_d_value);
    			}

    			if (dirty & /*belt_center, lean*/ 96 && rect_transform_value !== (rect_transform_value = "translate(" + /*belt_center*/ ctx[5].x + " " + /*belt_center*/ ctx[5].y + ") rotate(" + -/*lean*/ ctx[6] + ")")) {
    				attr_dev(rect, "transform", rect_transform_value);
    			}

    			if (dirty & /*torso_p, lean_torso*/ 257 && g_transform_value !== (g_transform_value = "translate(" + /*torso_p*/ ctx[0].x + " " + /*torso_p*/ ctx[0].y + ") rotate(" + /*lean_torso*/ ctx[8] + ") translate(0 -220)")) {
    				attr_dev(g, "transform", g_transform_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(g);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let lean_torso;
    	let waist_l;
    	let waist_r;
    	let armpit_r;
    	let armpit_l;
    	let groin;
    	let lean;
    	let belt_center;
    	let pq;
    	let pr;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Torso', slots, []);
    	let { lean_rad } = $$props;
    	let { torso_p } = $$props;
    	let { left } = $$props;
    	let { right } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (lean_rad === undefined && !('lean_rad' in $$props || $$self.$$.bound[$$self.$$.props['lean_rad']])) {
    			console.warn("<Torso> was created without expected prop 'lean_rad'");
    		}

    		if (torso_p === undefined && !('torso_p' in $$props || $$self.$$.bound[$$self.$$.props['torso_p']])) {
    			console.warn("<Torso> was created without expected prop 'torso_p'");
    		}

    		if (left === undefined && !('left' in $$props || $$self.$$.bound[$$self.$$.props['left']])) {
    			console.warn("<Torso> was created without expected prop 'left'");
    		}

    		if (right === undefined && !('right' in $$props || $$self.$$.bound[$$self.$$.props['right']])) {
    			console.warn("<Torso> was created without expected prop 'right'");
    		}
    	});

    	const writable_props = ['lean_rad', 'torso_p', 'left', 'right'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Torso> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('lean_rad' in $$props) $$invalidate(9, lean_rad = $$props.lean_rad);
    		if ('torso_p' in $$props) $$invalidate(0, torso_p = $$props.torso_p);
    		if ('left' in $$props) $$invalidate(10, left = $$props.left);
    		if ('right' in $$props) $$invalidate(11, right = $$props.right);
    	};

    	$$self.$capture_state = () => ({
    		clamp,
    		createSmoothControlPoints,
    		plus,
    		scale,
    		angleTo,
    		unit,
    		normal,
    		minus,
    		interpolate,
    		moveTowards,
    		move,
    		cubic,
    		line,
    		lean_rad,
    		torso_p,
    		left,
    		right,
    		armpit_l,
    		waist_l,
    		pr,
    		armpit_r,
    		waist_r,
    		pq,
    		belt_center,
    		lean,
    		groin,
    		lean_torso
    	});

    	$$self.$inject_state = $$props => {
    		if ('lean_rad' in $$props) $$invalidate(9, lean_rad = $$props.lean_rad);
    		if ('torso_p' in $$props) $$invalidate(0, torso_p = $$props.torso_p);
    		if ('left' in $$props) $$invalidate(10, left = $$props.left);
    		if ('right' in $$props) $$invalidate(11, right = $$props.right);
    		if ('armpit_l' in $$props) $$invalidate(12, armpit_l = $$props.armpit_l);
    		if ('waist_l' in $$props) $$invalidate(1, waist_l = $$props.waist_l);
    		if ('pr' in $$props) $$invalidate(3, pr = $$props.pr);
    		if ('armpit_r' in $$props) $$invalidate(13, armpit_r = $$props.armpit_r);
    		if ('waist_r' in $$props) $$invalidate(2, waist_r = $$props.waist_r);
    		if ('pq' in $$props) $$invalidate(4, pq = $$props.pq);
    		if ('belt_center' in $$props) $$invalidate(5, belt_center = $$props.belt_center);
    		if ('lean' in $$props) $$invalidate(6, lean = $$props.lean);
    		if ('groin' in $$props) $$invalidate(7, groin = $$props.groin);
    		if ('lean_torso' in $$props) $$invalidate(8, lean_torso = $$props.lean_torso);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*lean_rad*/ 512) {
    			$$invalidate(8, lean_torso = -lean_rad / Math.PI * 180);
    		}

    		if ($$self.$$.dirty & /*left*/ 1024) {
    			$$invalidate(1, waist_l = plus(left, { x: -380, y: -15 }));
    		}

    		if ($$self.$$.dirty & /*right*/ 2048) {
    			$$invalidate(2, waist_r = plus(right, { x: 400, y: 40 }));
    		}

    		if ($$self.$$.dirty & /*waist_r, waist_l*/ 6) {
    			$$invalidate(7, groin = plus(interpolate(waist_r, waist_l), scale(unit(normal(minus(waist_l, waist_r))), 260)));
    		}

    		if ($$self.$$.dirty & /*waist_r, waist_l*/ 6) {
    			$$invalidate(6, lean = angleTo(minus(waist_r, waist_l), { x: 1, y: 0 }) / Math.PI * 180);
    		}

    		if ($$self.$$.dirty & /*waist_l, waist_r, armpit_r*/ 8198) {
    			$$invalidate(5, belt_center = interpolate(waist_l, moveTowards(waist_r, armpit_r, 100)));
    		}

    		if ($$self.$$.dirty & /*waist_r, armpit_r*/ 8196) {
    			$$invalidate(4, pq = moveTowards(waist_r, armpit_r, 100));
    		}

    		if ($$self.$$.dirty & /*waist_l, armpit_l*/ 4098) {
    			$$invalidate(3, pr = moveTowards(waist_l, armpit_l, 100));
    		}
    	};

    	$$invalidate(13, armpit_r = { x: 458, y: 51 });
    	$$invalidate(12, armpit_l = { x: -482, y: 56 });

    	return [
    		torso_p,
    		waist_l,
    		waist_r,
    		pr,
    		pq,
    		belt_center,
    		lean,
    		groin,
    		lean_torso,
    		lean_rad,
    		left,
    		right,
    		armpit_l,
    		armpit_r
    	];
    }

    class Torso extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$c, create_fragment$c, safe_not_equal, {
    			lean_rad: 9,
    			torso_p: 0,
    			left: 10,
    			right: 11
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Torso",
    			options,
    			id: create_fragment$c.name
    		});
    	}

    	get lean_rad() {
    		throw new Error("<Torso>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set lean_rad(value) {
    		throw new Error("<Torso>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get torso_p() {
    		throw new Error("<Torso>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set torso_p(value) {
    		throw new Error("<Torso>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get left() {
    		throw new Error("<Torso>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set left(value) {
    		throw new Error("<Torso>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get right() {
    		throw new Error("<Torso>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set right(value) {
    		throw new Error("<Torso>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Shoe.svelte generated by Svelte v3.59.2 */
    const file$b = "src/components/Shoe.svelte";

    function create_fragment$b(ctx) {
    	let g2;
    	let g0;
    	let use0;
    	let g0_transform_value;
    	let g1;
    	let use1;
    	let g1_transform_value;
    	let g2_transform_value;

    	const block = {
    		c: function create() {
    			g2 = svg_element("g");
    			g0 = svg_element("g");
    			use0 = svg_element("use");
    			g1 = svg_element("g");
    			use1 = svg_element("use");
    			attr_dev(use0, "href", "#ankle");
    			add_location(use0, file$b, 27, 4, 601);
    			attr_dev(g0, "transform", g0_transform_value = "rotate(" + -/*sign*/ ctx[2] * /*angle*/ ctx[3] + ")");
    			add_location(g0, file$b, 26, 2, 557);
    			attr_dev(use1, "href", "#foot");
    			add_location(use1, file$b, 30, 4, 673);
    			attr_dev(g1, "transform", g1_transform_value = "rotate(" + /*$angle_toe*/ ctx[4] + ")");
    			add_location(g1, file$b, 29, 2, 632);
    			attr_dev(g2, "fill", "red");
    			attr_dev(g2, "transform", g2_transform_value = "translate(" + /*end*/ ctx[0].x + " " + /*end*/ ctx[0].y + ") scale(" + -/*orientation*/ ctx[1] + ", 1)");
    			add_location(g2, file$b, 25, 0, 476);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, g2, anchor);
    			append_dev(g2, g0);
    			append_dev(g0, use0);
    			append_dev(g2, g1);
    			append_dev(g1, use1);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*sign, angle*/ 12 && g0_transform_value !== (g0_transform_value = "rotate(" + -/*sign*/ ctx[2] * /*angle*/ ctx[3] + ")")) {
    				attr_dev(g0, "transform", g0_transform_value);
    			}

    			if (dirty & /*$angle_toe*/ 16 && g1_transform_value !== (g1_transform_value = "rotate(" + /*$angle_toe*/ ctx[4] + ")")) {
    				attr_dev(g1, "transform", g1_transform_value);
    			}

    			if (dirty & /*end, orientation*/ 3 && g2_transform_value !== (g2_transform_value = "translate(" + /*end*/ ctx[0].x + " " + /*end*/ ctx[0].y + ") scale(" + -/*orientation*/ ctx[1] + ", 1)")) {
    				attr_dev(g2, "transform", g2_transform_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(g2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let angle;
    	let sign;
    	let $angle_toe;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Shoe', slots, []);
    	let { end } = $$props;
    	let { cp } = $$props;
    	let { orientation } = $$props;
    	let { on_floor } = $$props;
    	let angle_toe = spring(-2.5);
    	validate_store(angle_toe, 'angle_toe');
    	component_subscribe($$self, angle_toe, value => $$invalidate(4, $angle_toe = value));

    	$$self.$$.on_mount.push(function () {
    		if (end === undefined && !('end' in $$props || $$self.$$.bound[$$self.$$.props['end']])) {
    			console.warn("<Shoe> was created without expected prop 'end'");
    		}

    		if (cp === undefined && !('cp' in $$props || $$self.$$.bound[$$self.$$.props['cp']])) {
    			console.warn("<Shoe> was created without expected prop 'cp'");
    		}

    		if (orientation === undefined && !('orientation' in $$props || $$self.$$.bound[$$self.$$.props['orientation']])) {
    			console.warn("<Shoe> was created without expected prop 'orientation'");
    		}

    		if (on_floor === undefined && !('on_floor' in $$props || $$self.$$.bound[$$self.$$.props['on_floor']])) {
    			console.warn("<Shoe> was created without expected prop 'on_floor'");
    		}
    	});

    	const writable_props = ['end', 'cp', 'orientation', 'on_floor'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Shoe> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('end' in $$props) $$invalidate(0, end = $$props.end);
    		if ('cp' in $$props) $$invalidate(6, cp = $$props.cp);
    		if ('orientation' in $$props) $$invalidate(1, orientation = $$props.orientation);
    		if ('on_floor' in $$props) $$invalidate(7, on_floor = $$props.on_floor);
    	};

    	$$self.$capture_state = () => ({
    		angleTo,
    		minus,
    		spring,
    		end,
    		cp,
    		orientation,
    		on_floor,
    		angle_toe,
    		sign,
    		angle,
    		$angle_toe
    	});

    	$$self.$inject_state = $$props => {
    		if ('end' in $$props) $$invalidate(0, end = $$props.end);
    		if ('cp' in $$props) $$invalidate(6, cp = $$props.cp);
    		if ('orientation' in $$props) $$invalidate(1, orientation = $$props.orientation);
    		if ('on_floor' in $$props) $$invalidate(7, on_floor = $$props.on_floor);
    		if ('angle_toe' in $$props) $$invalidate(5, angle_toe = $$props.angle_toe);
    		if ('sign' in $$props) $$invalidate(2, sign = $$props.sign);
    		if ('angle' in $$props) $$invalidate(3, angle = $$props.angle);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*cp, end*/ 65) {
    			$$invalidate(3, angle = -angleTo(minus(cp, end), { x: 0, y: -1 }) / Math.PI * 180);
    		}

    		if ($$self.$$.dirty & /*orientation*/ 2) {
    			$$invalidate(2, sign = Math.sign(orientation));
    		}

    		if ($$self.$$.dirty & /*on_floor, sign, cp, end*/ 197) {
    			angle_toe.update(_ => on_floor
    			? -2.5
    			: -sign * (-angleTo(minus(cp, end), { x: 0, y: -1 }) / Math.PI * 180));
    		}
    	};

    	return [end, orientation, sign, angle, $angle_toe, angle_toe, cp, on_floor];
    }

    class Shoe extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$b, create_fragment$b, safe_not_equal, {
    			end: 0,
    			cp: 6,
    			orientation: 1,
    			on_floor: 7
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Shoe",
    			options,
    			id: create_fragment$b.name
    		});
    	}

    	get end() {
    		throw new Error("<Shoe>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set end(value) {
    		throw new Error("<Shoe>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get cp() {
    		throw new Error("<Shoe>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set cp(value) {
    		throw new Error("<Shoe>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get orientation() {
    		throw new Error("<Shoe>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set orientation(value) {
    		throw new Error("<Shoe>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get on_floor() {
    		throw new Error("<Shoe>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set on_floor(value) {
    		throw new Error("<Shoe>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Legs.svelte generated by Svelte v3.59.2 */
    const file$a = "src/components/Legs.svelte";

    function create_fragment$a(ctx) {
    	let g;
    	let shoe0;
    	let shoe1;
    	let path0;
    	let path0_d_value;
    	let path1;
    	let path1_d_value;
    	let current;

    	shoe0 = new Shoe({
    			props: {
    				on_floor: /*on_floor_l*/ ctx[4],
    				end: /*points_l*/ ctx[0][0],
    				cp: /*path_l*/ ctx[9],
    				orientation: /*orientation_l*/ ctx[3]
    			},
    			$$inline: true
    		});

    	shoe1 = new Shoe({
    			props: {
    				on_floor: /*on_floor_r*/ ctx[5],
    				end: /*points_r*/ ctx[1][0],
    				cp: /*path_r*/ ctx[8],
    				orientation: /*orientation_r*/ ctx[2]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			g = svg_element("g");
    			create_component(shoe0.$$.fragment);
    			create_component(shoe1.$$.fragment);
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			attr_dev(path0, "id", "legs");
    			attr_dev(path0, "stroke-width", "240");
    			attr_dev(path0, "stroke", "var(--green)");
    			attr_dev(path0, "d", path0_d_value = "" + (move(/*points_l*/ ctx[0][0]) + " " + cubic(.../*cp_l*/ ctx[7]) + " " + cubic(/*cp_2_1*/ ctx[11], /*cp_2_2*/ ctx[10], /*points_r*/ ctx[1][2])));
    			attr_dev(path0, "class", "svelte-1khr0nj");
    			add_location(path0, file$a, 56, 2, 1436);
    			attr_dev(path1, "id", "legs2");
    			attr_dev(path1, "stroke-width", "240");
    			attr_dev(path1, "stroke", "var(--green)");
    			attr_dev(path1, "d", path1_d_value = "" + (move(/*points_r*/ ctx[1][0]) + " " + cubic(.../*cp_r_reversed*/ ctx[6]) + " " + cubic(/*cp_2_2*/ ctx[10], /*cp_2_1*/ ctx[11], /*points_l*/ ctx[0][2])));
    			attr_dev(path1, "class", "svelte-1khr0nj");
    			add_location(path1, file$a, 63, 2, 1597);
    			attr_dev(g, "id", "legs_group");
    			add_location(g, file$a, 41, 0, 1186);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, g, anchor);
    			mount_component(shoe0, g, null);
    			mount_component(shoe1, g, null);
    			append_dev(g, path0);
    			append_dev(g, path1);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const shoe0_changes = {};
    			if (dirty & /*on_floor_l*/ 16) shoe0_changes.on_floor = /*on_floor_l*/ ctx[4];
    			if (dirty & /*points_l*/ 1) shoe0_changes.end = /*points_l*/ ctx[0][0];
    			if (dirty & /*path_l*/ 512) shoe0_changes.cp = /*path_l*/ ctx[9];
    			if (dirty & /*orientation_l*/ 8) shoe0_changes.orientation = /*orientation_l*/ ctx[3];
    			shoe0.$set(shoe0_changes);
    			const shoe1_changes = {};
    			if (dirty & /*on_floor_r*/ 32) shoe1_changes.on_floor = /*on_floor_r*/ ctx[5];
    			if (dirty & /*points_r*/ 2) shoe1_changes.end = /*points_r*/ ctx[1][0];
    			if (dirty & /*path_r*/ 256) shoe1_changes.cp = /*path_r*/ ctx[8];
    			if (dirty & /*orientation_r*/ 4) shoe1_changes.orientation = /*orientation_r*/ ctx[2];
    			shoe1.$set(shoe1_changes);

    			if (!current || dirty & /*points_l, cp_l, cp_2_1, cp_2_2, points_r*/ 3203 && path0_d_value !== (path0_d_value = "" + (move(/*points_l*/ ctx[0][0]) + " " + cubic(.../*cp_l*/ ctx[7]) + " " + cubic(/*cp_2_1*/ ctx[11], /*cp_2_2*/ ctx[10], /*points_r*/ ctx[1][2])))) {
    				attr_dev(path0, "d", path0_d_value);
    			}

    			if (!current || dirty & /*points_r, cp_r_reversed, cp_2_2, cp_2_1, points_l*/ 3139 && path1_d_value !== (path1_d_value = "" + (move(/*points_r*/ ctx[1][0]) + " " + cubic(.../*cp_r_reversed*/ ctx[6]) + " " + cubic(/*cp_2_2*/ ctx[10], /*cp_2_1*/ ctx[11], /*points_l*/ ctx[0][2])))) {
    				attr_dev(path1, "d", path1_d_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(shoe0.$$.fragment, local);
    			transition_in(shoe1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(shoe0.$$.fragment, local);
    			transition_out(shoe1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(g);
    			destroy_component(shoe0);
    			destroy_component(shoe1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function getPoint(distance, d) {
    	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    	path.setAttribute('d', d);
    	return path.getPointAtLength(distance);
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let cp_l;
    	let cp_r;
    	let cp_r_reversed;
    	let cp_2_1;
    	let cp_2_2;
    	let path_l;
    	let path_r;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Legs', slots, []);
    	let { points_l } = $$props;
    	let { points_r } = $$props;
    	let { orientation_r } = $$props;
    	let { orientation_l } = $$props;
    	let { on_floor_l } = $$props;
    	let { on_floor_r } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (points_l === undefined && !('points_l' in $$props || $$self.$$.bound[$$self.$$.props['points_l']])) {
    			console.warn("<Legs> was created without expected prop 'points_l'");
    		}

    		if (points_r === undefined && !('points_r' in $$props || $$self.$$.bound[$$self.$$.props['points_r']])) {
    			console.warn("<Legs> was created without expected prop 'points_r'");
    		}

    		if (orientation_r === undefined && !('orientation_r' in $$props || $$self.$$.bound[$$self.$$.props['orientation_r']])) {
    			console.warn("<Legs> was created without expected prop 'orientation_r'");
    		}

    		if (orientation_l === undefined && !('orientation_l' in $$props || $$self.$$.bound[$$self.$$.props['orientation_l']])) {
    			console.warn("<Legs> was created without expected prop 'orientation_l'");
    		}

    		if (on_floor_l === undefined && !('on_floor_l' in $$props || $$self.$$.bound[$$self.$$.props['on_floor_l']])) {
    			console.warn("<Legs> was created without expected prop 'on_floor_l'");
    		}

    		if (on_floor_r === undefined && !('on_floor_r' in $$props || $$self.$$.bound[$$self.$$.props['on_floor_r']])) {
    			console.warn("<Legs> was created without expected prop 'on_floor_r'");
    		}
    	});

    	const writable_props = [
    		'points_l',
    		'points_r',
    		'orientation_r',
    		'orientation_l',
    		'on_floor_l',
    		'on_floor_r'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Legs> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('points_l' in $$props) $$invalidate(0, points_l = $$props.points_l);
    		if ('points_r' in $$props) $$invalidate(1, points_r = $$props.points_r);
    		if ('orientation_r' in $$props) $$invalidate(2, orientation_r = $$props.orientation_r);
    		if ('orientation_l' in $$props) $$invalidate(3, orientation_l = $$props.orientation_l);
    		if ('on_floor_l' in $$props) $$invalidate(4, on_floor_l = $$props.on_floor_l);
    		if ('on_floor_r' in $$props) $$invalidate(5, on_floor_r = $$props.on_floor_r);
    	};

    	$$self.$capture_state = () => ({
    		createSmoothControlPoints,
    		interpolate,
    		move,
    		cubic,
    		Shoe,
    		points_l,
    		points_r,
    		orientation_r,
    		orientation_l,
    		on_floor_l,
    		on_floor_r,
    		getPoint,
    		cp_r_reversed,
    		path_r,
    		cp_l,
    		path_l,
    		cp_r,
    		cp_2_2,
    		cp_2_1
    	});

    	$$self.$inject_state = $$props => {
    		if ('points_l' in $$props) $$invalidate(0, points_l = $$props.points_l);
    		if ('points_r' in $$props) $$invalidate(1, points_r = $$props.points_r);
    		if ('orientation_r' in $$props) $$invalidate(2, orientation_r = $$props.orientation_r);
    		if ('orientation_l' in $$props) $$invalidate(3, orientation_l = $$props.orientation_l);
    		if ('on_floor_l' in $$props) $$invalidate(4, on_floor_l = $$props.on_floor_l);
    		if ('on_floor_r' in $$props) $$invalidate(5, on_floor_r = $$props.on_floor_r);
    		if ('cp_r_reversed' in $$props) $$invalidate(6, cp_r_reversed = $$props.cp_r_reversed);
    		if ('path_r' in $$props) $$invalidate(8, path_r = $$props.path_r);
    		if ('cp_l' in $$props) $$invalidate(7, cp_l = $$props.cp_l);
    		if ('path_l' in $$props) $$invalidate(9, path_l = $$props.path_l);
    		if ('cp_r' in $$props) $$invalidate(12, cp_r = $$props.cp_r);
    		if ('cp_2_2' in $$props) $$invalidate(10, cp_2_2 = $$props.cp_2_2);
    		if ('cp_2_1' in $$props) $$invalidate(11, cp_2_1 = $$props.cp_2_1);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*points_l*/ 1) {
    			$$invalidate(7, cp_l = createSmoothControlPoints(points_l[0], points_l[1], points_l[2], 0.2));
    		}

    		if ($$self.$$.dirty & /*points_r*/ 2) {
    			$$invalidate(12, cp_r = createSmoothControlPoints(points_r[2], points_r[1], points_r[0], 0.2));
    		}

    		if ($$self.$$.dirty & /*points_r*/ 2) {
    			$$invalidate(6, cp_r_reversed = createSmoothControlPoints(points_r[0], points_r[1], points_r[2], 0.2));
    		}

    		if ($$self.$$.dirty & /*points_l, cp_l*/ 129) {
    			$$invalidate(11, cp_2_1 = interpolate(points_l[2], cp_l[1], -.4));
    		}

    		if ($$self.$$.dirty & /*points_r, cp_r*/ 4098) {
    			$$invalidate(10, cp_2_2 = interpolate(points_r[2], cp_r[0], -.4));
    		}

    		if ($$self.$$.dirty & /*points_l, cp_l*/ 129) {
    			$$invalidate(9, path_l = getPoint(300, `${move(points_l[0])} ${cubic(...cp_l)}`));
    		}

    		if ($$self.$$.dirty & /*points_r, cp_r_reversed*/ 66) {
    			$$invalidate(8, path_r = getPoint(300, `${move(points_r[0])} ${cubic(...cp_r_reversed)}`));
    		}
    	};

    	return [
    		points_l,
    		points_r,
    		orientation_r,
    		orientation_l,
    		on_floor_l,
    		on_floor_r,
    		cp_r_reversed,
    		cp_l,
    		path_r,
    		path_l,
    		cp_2_2,
    		cp_2_1,
    		cp_r
    	];
    }

    class Legs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$a, create_fragment$a, safe_not_equal, {
    			points_l: 0,
    			points_r: 1,
    			orientation_r: 2,
    			orientation_l: 3,
    			on_floor_l: 4,
    			on_floor_r: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Legs",
    			options,
    			id: create_fragment$a.name
    		});
    	}

    	get points_l() {
    		throw new Error("<Legs>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set points_l(value) {
    		throw new Error("<Legs>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get points_r() {
    		throw new Error("<Legs>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set points_r(value) {
    		throw new Error("<Legs>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get orientation_r() {
    		throw new Error("<Legs>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set orientation_r(value) {
    		throw new Error("<Legs>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get orientation_l() {
    		throw new Error("<Legs>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set orientation_l(value) {
    		throw new Error("<Legs>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get on_floor_l() {
    		throw new Error("<Legs>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set on_floor_l(value) {
    		throw new Error("<Legs>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get on_floor_r() {
    		throw new Error("<Legs>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set on_floor_r(value) {
    		throw new Error("<Legs>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Head.svelte generated by Svelte v3.59.2 */

    const file$9 = "src/components/Head.svelte";

    function create_fragment$9(ctx) {
    	let g4;
    	let circle0;
    	let g0;
    	let path0;
    	let circle1;
    	let path1;
    	let g1;
    	let path2;
    	let path3;
    	let path4;
    	let path5;
    	let path6;
    	let g3;
    	let g2;
    	let path7;
    	let path8;
    	let path9;
    	let g3_transform_value;
    	let g4_transform_value;

    	const block = {
    		c: function create() {
    			g4 = svg_element("g");
    			circle0 = svg_element("circle");
    			g0 = svg_element("g");
    			path0 = svg_element("path");
    			circle1 = svg_element("circle");
    			path1 = svg_element("path");
    			g1 = svg_element("g");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			path5 = svg_element("path");
    			path6 = svg_element("path");
    			g3 = svg_element("g");
    			g2 = svg_element("g");
    			path7 = svg_element("path");
    			path8 = svg_element("path");
    			path9 = svg_element("path");
    			attr_dev(circle0, "cx", "86");
    			attr_dev(circle0, "cy", "548.5");
    			attr_dev(circle0, "r", "77.5");
    			attr_dev(circle0, "fill", "var(--yellow)");
    			add_location(circle0, file$9, 10, 2, 221);
    			attr_dev(path0, "d", "M1001.5 548.5C1001.5 591.302 966.802 626 924 626C881.198 626 846.5 591.302 846.5 548.5C846.5 505.698 881.198 471 924 471C966.802 471 1001.5 505.698 1001.5 548.5Z");
    			add_location(path0, file$9, 18, 4, 333);
    			attr_dev(circle1, "cx", "71.5");
    			attr_dev(circle1, "cy", "549.5");
    			attr_dev(circle1, "r", "33.5");
    			add_location(circle1, file$9, 21, 4, 524);
    			attr_dev(g0, "fill", "var(--orange)");
    			add_location(g0, file$9, 17, 2, 304);
    			attr_dev(path1, "d", "M86.5 301C86.5 220.919 151.419 156 231.5 156H747.5C827.581 156 892.5 220.919 892.5 301V443.5V586C892.5 666.081 827.581 731 747.5 731H231.5C151.419 731 86.5 666.081 86.5 586V301Z");
    			attr_dev(path1, "fill", "var(--yellow)");
    			add_location(path1, file$9, 24, 2, 575);
    			attr_dev(path2, "d", "M848 485H875C924.153 485 964 445.153 964 396V396C964 346.847 924.153 307 875 307H848L848 485Z");
    			add_location(path2, file$9, 30, 4, 830);
    			attr_dev(path3, "d", "M133 485H109C59.8467 485 20 445.153 20 396V396C20 346.847 59.8467 307 109 307H133L133 485Z");
    			add_location(path3, file$9, 33, 4, 953);
    			attr_dev(path4, "d", "M233 211L289 211C338.153 211 378 171.153 378 122V122C378 72.8467 338.153 33 289 33L233 33L233 211Z");
    			add_location(path4, file$9, 36, 4, 1073);
    			attr_dev(path5, "d", "M753 0C869.256 0 963.5 94.2441 963.5 210.5V210.5C963.5 326.756 869.256 421 753 421H670.5C649.143 421 638.464 421 629.449 420.396C494.556 411.358 387.143 303.944 378.104 169.051C377.5 160.036 377.5 149.357 377.5 128V1.55349C377.5 1.03726 377.5 0.77915 377.593 0.578841C377.693 0.364602 377.865 0.192495 378.079 0.093013C378.279 0 378.537 0 379.054 0L753 0Z");
    			add_location(path5, file$9, 39, 4, 1201);
    			attr_dev(path6, "d", "M403.5 93V219.5C403.5 330.785 313.285 421 202 421V421C90.7146 421 0.500005 330.785 0.500005 219.5V93L403.5 93Z");
    			add_location(path6, file$9, 42, 4, 1586);
    			attr_dev(g1, "fill", "var(--black)");
    			add_location(g1, file$9, 29, 2, 802);
    			attr_dev(path7, "d", "M394 548.5C394 580.256 368.256 606 336.5 606C304.744 606 279 580.256 279 548.5C279 516.744 304.744 491 336.5 491C368.256 491 394 516.744 394 548.5Z");
    			add_location(path7, file$9, 48, 6, 1817);
    			attr_dev(path8, "d", "M691 548.5C691 580.256 665.256 606 633.5 606C601.744 606 576 580.256 576 548.5C576 516.744 601.744 491 633.5 491C665.256 491 691 516.744 691 548.5Z");
    			add_location(path8, file$9, 51, 6, 2000);
    			attr_dev(g2, "fill", "var(--black)");
    			add_location(g2, file$9, 47, 4, 1787);
    			attr_dev(path9, "d", "M445 636H525");
    			attr_dev(path9, "stroke", "var(--orange)");
    			attr_dev(path9, "stroke-width", "40");
    			attr_dev(path9, "stroke-linecap", "round");
    			add_location(path9, file$9, 55, 4, 2190);
    			attr_dev(g3, "id", "face");
    			attr_dev(g3, "transform", g3_transform_value = "translate(" + /*dy*/ ctx[0].x + ", " + /*dy*/ ctx[0].y + ")");
    			add_location(g3, file$9, 46, 2, 1731);
    			attr_dev(g4, "transform", g4_transform_value = "translate(" + /*torso_p*/ ctx[1].x + " " + /*torso_p*/ ctx[1].y + ") rotate(" + /*lean*/ ctx[2] + ")translate(-501 -1270)");
    			attr_dev(g4, "id", "head");
    			add_location(g4, file$9, 9, 0, 122);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, g4, anchor);
    			append_dev(g4, circle0);
    			append_dev(g4, g0);
    			append_dev(g0, path0);
    			append_dev(g0, circle1);
    			append_dev(g4, path1);
    			append_dev(g4, g1);
    			append_dev(g1, path2);
    			append_dev(g1, path3);
    			append_dev(g1, path4);
    			append_dev(g1, path5);
    			append_dev(g1, path6);
    			append_dev(g4, g3);
    			append_dev(g3, g2);
    			append_dev(g2, path7);
    			append_dev(g2, path8);
    			append_dev(g3, path9);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*dy*/ 1 && g3_transform_value !== (g3_transform_value = "translate(" + /*dy*/ ctx[0].x + ", " + /*dy*/ ctx[0].y + ")")) {
    				attr_dev(g3, "transform", g3_transform_value);
    			}

    			if (dirty & /*torso_p, lean*/ 6 && g4_transform_value !== (g4_transform_value = "translate(" + /*torso_p*/ ctx[1].x + " " + /*torso_p*/ ctx[1].y + ") rotate(" + /*lean*/ ctx[2] + ")translate(-501 -1270)")) {
    				attr_dev(g4, "transform", g4_transform_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(g4);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let lean;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Head', slots, []);
    	let { dy } = $$props;
    	let { lean_rad } = $$props;
    	let { torso_p } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (dy === undefined && !('dy' in $$props || $$self.$$.bound[$$self.$$.props['dy']])) {
    			console.warn("<Head> was created without expected prop 'dy'");
    		}

    		if (lean_rad === undefined && !('lean_rad' in $$props || $$self.$$.bound[$$self.$$.props['lean_rad']])) {
    			console.warn("<Head> was created without expected prop 'lean_rad'");
    		}

    		if (torso_p === undefined && !('torso_p' in $$props || $$self.$$.bound[$$self.$$.props['torso_p']])) {
    			console.warn("<Head> was created without expected prop 'torso_p'");
    		}
    	});

    	const writable_props = ['dy', 'lean_rad', 'torso_p'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Head> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('dy' in $$props) $$invalidate(0, dy = $$props.dy);
    		if ('lean_rad' in $$props) $$invalidate(3, lean_rad = $$props.lean_rad);
    		if ('torso_p' in $$props) $$invalidate(1, torso_p = $$props.torso_p);
    	};

    	$$self.$capture_state = () => ({ dy, lean_rad, torso_p, lean });

    	$$self.$inject_state = $$props => {
    		if ('dy' in $$props) $$invalidate(0, dy = $$props.dy);
    		if ('lean_rad' in $$props) $$invalidate(3, lean_rad = $$props.lean_rad);
    		if ('torso_p' in $$props) $$invalidate(1, torso_p = $$props.torso_p);
    		if ('lean' in $$props) $$invalidate(2, lean = $$props.lean);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*lean_rad*/ 8) {
    			$$invalidate(2, lean = -lean_rad / Math.PI * 180);
    		}
    	};

    	return [dy, torso_p, lean, lean_rad];
    }

    class Head extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$9, create_fragment$9, safe_not_equal, { dy: 0, lean_rad: 3, torso_p: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Head",
    			options,
    			id: create_fragment$9.name
    		});
    	}

    	get dy() {
    		throw new Error("<Head>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dy(value) {
    		throw new Error("<Head>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get lean_rad() {
    		throw new Error("<Head>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set lean_rad(value) {
    		throw new Error("<Head>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get torso_p() {
    		throw new Error("<Head>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set torso_p(value) {
    		throw new Error("<Head>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Clouds.svelte generated by Svelte v3.59.2 */

    const file$8 = "src/components/Clouds.svelte";

    function create_fragment$8(ctx) {
    	let g5;
    	let use0;
    	let g0;
    	let use1;
    	let g0_transform_value;
    	let g1;
    	let use2;
    	let g1_transform_value;
    	let g2;
    	let use3;
    	let g2_transform_value;
    	let g3;
    	let use4;
    	let g3_transform_value;
    	let g4;
    	let use5;
    	let g4_transform_value;

    	const block = {
    		c: function create() {
    			g5 = svg_element("g");
    			use0 = svg_element("use");
    			g0 = svg_element("g");
    			use1 = svg_element("use");
    			g1 = svg_element("g");
    			use2 = svg_element("use");
    			g2 = svg_element("g");
    			use3 = svg_element("use");
    			g3 = svg_element("g");
    			use4 = svg_element("use");
    			g4 = svg_element("g");
    			use5 = svg_element("use");
    			attr_dev(use0, "href", "#shadow");
    			add_location(use0, file$8, 35, 2, 719);
    			attr_dev(use1, "href", "#cloud");
    			attr_dev(use1, "fill", "var(--shadow)");
    			attr_dev(use1, "transform", "translate(0 1000)");
    			add_location(use1, file$8, 38, 4, 805);
    			attr_dev(g0, "transform", g0_transform_value = "translate(" + /*cloud1*/ ctx[0].p + " 0)");
    			attr_dev(g0, "class", "cloud");
    			add_location(g0, file$8, 37, 2, 747);
    			attr_dev(use2, "href", "#cloud");
    			attr_dev(use2, "fill", "white");
    			attr_dev(use2, "transform", "translate(0 700) scale(-.5, .5)");
    			add_location(use2, file$8, 42, 4, 948);
    			attr_dev(g1, "transform", g1_transform_value = "translate(" + /*cloud2*/ ctx[1].p + " 0)");
    			attr_dev(g1, "class", "cloud");
    			add_location(g1, file$8, 41, 2, 890);
    			attr_dev(use3, "href", "#cloud");
    			attr_dev(use3, "fill", "var(--shadow)");
    			attr_dev(use3, "transform", "translate(0, 1200) scale(.4)");
    			add_location(use3, file$8, 46, 4, 1097);
    			attr_dev(g2, "transform", g2_transform_value = "translate(" + /*cloud3*/ ctx[2].p + " 0)");
    			attr_dev(g2, "class", "cloud");
    			add_location(g2, file$8, 45, 2, 1039);
    			attr_dev(use4, "href", "#cloud");
    			attr_dev(use4, "fill", "white");
    			attr_dev(use4, "transform", "translate(0, 800) scale(-.9, .9)");
    			add_location(use4, file$8, 50, 4, 1251);
    			attr_dev(g3, "transform", g3_transform_value = "translate(" + /*cloud4*/ ctx[3].p + " 0)");
    			attr_dev(g3, "class", "cloud");
    			add_location(g3, file$8, 49, 2, 1193);
    			attr_dev(use5, "href", "#cloud");
    			attr_dev(use5, "fill", "white");
    			attr_dev(use5, "transform", "translate(0, 1050) scale(1.1, 1.1)");
    			add_location(use5, file$8, 54, 4, 1401);
    			attr_dev(g4, "transform", g4_transform_value = "translate(" + /*cloud5*/ ctx[4].p + " 0)");
    			attr_dev(g4, "class", "cloud");
    			add_location(g4, file$8, 53, 2, 1343);
    			attr_dev(g5, "class", "svg_content");
    			add_location(g5, file$8, 34, 0, 693);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, g5, anchor);
    			append_dev(g5, use0);
    			append_dev(g5, g0);
    			append_dev(g0, use1);
    			append_dev(g5, g1);
    			append_dev(g1, use2);
    			append_dev(g5, g2);
    			append_dev(g2, use3);
    			append_dev(g5, g3);
    			append_dev(g3, use4);
    			append_dev(g5, g4);
    			append_dev(g4, use5);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*cloud1*/ 1 && g0_transform_value !== (g0_transform_value = "translate(" + /*cloud1*/ ctx[0].p + " 0)")) {
    				attr_dev(g0, "transform", g0_transform_value);
    			}

    			if (dirty & /*cloud2*/ 2 && g1_transform_value !== (g1_transform_value = "translate(" + /*cloud2*/ ctx[1].p + " 0)")) {
    				attr_dev(g1, "transform", g1_transform_value);
    			}

    			if (dirty & /*cloud3*/ 4 && g2_transform_value !== (g2_transform_value = "translate(" + /*cloud3*/ ctx[2].p + " 0)")) {
    				attr_dev(g2, "transform", g2_transform_value);
    			}

    			if (dirty & /*cloud4*/ 8 && g3_transform_value !== (g3_transform_value = "translate(" + /*cloud4*/ ctx[3].p + " 0)")) {
    				attr_dev(g3, "transform", g3_transform_value);
    			}

    			if (dirty & /*cloud5*/ 16 && g4_transform_value !== (g4_transform_value = "translate(" + /*cloud5*/ ctx[4].p + " 0)")) {
    				attr_dev(g4, "transform", g4_transform_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(g5);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function lerpCloud(p, dt) {
    	p.p += p.v * dt * .35;

    	if (p.p > 6000) {
    		p.p = -6000;
    	}

    	if (p.p < -6000) {
    		p.p = 6000;
    	}

    	return p;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Clouds', slots, []);
    	let cloud1 = { p: 5400, v: -4 };
    	let cloud2 = { p: -300, v: -10 };
    	let cloud3 = { p: -300, v: 8 };
    	let cloud4 = { p: 1700, v: 5 };
    	let cloud5 = { p: -2700, v: 3 };
    	let old_t = 0;

    	requestAnimationFrame(function go(t) {
    		t /= 128;
    		const dt = old_t - t;
    		old_t = t;
    		$$invalidate(0, cloud1 = lerpCloud(cloud1, dt));
    		$$invalidate(1, cloud2 = lerpCloud(cloud2, dt));
    		$$invalidate(2, cloud3 = lerpCloud(cloud3, dt));
    		$$invalidate(3, cloud4 = lerpCloud(cloud4, dt));
    		$$invalidate(4, cloud5 = lerpCloud(cloud5, dt));
    		requestAnimationFrame(go);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Clouds> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		cloud1,
    		cloud2,
    		cloud3,
    		cloud4,
    		cloud5,
    		old_t,
    		lerpCloud
    	});

    	$$self.$inject_state = $$props => {
    		if ('cloud1' in $$props) $$invalidate(0, cloud1 = $$props.cloud1);
    		if ('cloud2' in $$props) $$invalidate(1, cloud2 = $$props.cloud2);
    		if ('cloud3' in $$props) $$invalidate(2, cloud3 = $$props.cloud3);
    		if ('cloud4' in $$props) $$invalidate(3, cloud4 = $$props.cloud4);
    		if ('cloud5' in $$props) $$invalidate(4, cloud5 = $$props.cloud5);
    		if ('old_t' in $$props) old_t = $$props.old_t;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [cloud1, cloud2, cloud3, cloud4, cloud5];
    }

    class Clouds extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Clouds",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src/components/Bg.svelte generated by Svelte v3.59.2 */
    const file$7 = "src/components/Bg.svelte";

    function create_fragment$7(ctx) {
    	let svg;
    	let defs;
    	let ellipse;
    	let g;
    	let circle0;
    	let circle1;
    	let circle2;
    	let circle3;
    	let rect;
    	let clouds;
    	let current;
    	clouds = new Clouds({ $$inline: true });

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			defs = svg_element("defs");
    			ellipse = svg_element("ellipse");
    			g = svg_element("g");
    			circle0 = svg_element("circle");
    			circle1 = svg_element("circle");
    			circle2 = svg_element("circle");
    			circle3 = svg_element("circle");
    			rect = svg_element("rect");
    			create_component(clouds.$$.fragment);
    			attr_dev(ellipse, "id", "shadow");
    			attr_dev(ellipse, "cx", "820");
    			attr_dev(ellipse, "cy", "3000");
    			attr_dev(ellipse, "rx", "2600");
    			attr_dev(ellipse, "ry", "350");
    			attr_dev(ellipse, "fill", "var(--shadow)");
    			add_location(ellipse, file$7, 12, 4, 226);
    			attr_dev(circle0, "cx", "-919");
    			attr_dev(circle0, "cy", "962");
    			attr_dev(circle0, "r", "481");
    			add_location(circle0, file$7, 21, 6, 376);
    			attr_dev(circle1, "cx", "-324.5");
    			attr_dev(circle1, "cy", "721.5");
    			attr_dev(circle1, "r", "721.5");
    			add_location(circle1, file$7, 26, 6, 452);
    			attr_dev(circle2, "cx", "396.5");
    			attr_dev(circle2, "cy", "721.5");
    			attr_dev(circle2, "r", "506.5");
    			add_location(circle2, file$7, 30, 6, 526);
    			attr_dev(circle3, "cx", "972");
    			attr_dev(circle3, "cy", "1032");
    			attr_dev(circle3, "r", "417");
    			add_location(circle3, file$7, 35, 6, 607);
    			attr_dev(rect, "x", "-954");
    			attr_dev(rect, "y", "897");
    			attr_dev(rect, "width", "1926");
    			attr_dev(rect, "height", "552");
    			add_location(rect, file$7, 40, 6, 683);
    			attr_dev(g, "id", "cloud");
    			add_location(g, file$7, 20, 4, 355);
    			add_location(defs, file$7, 11, 2, 215);
    			attr_dev(svg, "id", "background-svg");
    			attr_dev(svg, "viewBox", "-3750 -300 9140 4200");
    			attr_dev(svg, "preserveAspectRatio", "xMidYMid slice");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg, file$7, 4, 0, 59);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, defs);
    			append_dev(defs, ellipse);
    			append_dev(defs, g);
    			append_dev(g, circle0);
    			append_dev(g, circle1);
    			append_dev(g, circle2);
    			append_dev(g, circle3);
    			append_dev(g, rect);
    			mount_component(clouds, svg, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(clouds.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(clouds.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			destroy_component(clouds);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Bg', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Bg> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Clouds });
    	return [];
    }

    class Bg extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Bg",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src/components/Defs.svelte generated by Svelte v3.59.2 */

    const file$6 = "src/components/Defs.svelte";

    function create_fragment$6(ctx) {
    	let defs;
    	let path0;
    	let mask;
    	let circle0;
    	let g1;
    	let circle1;
    	let g0;
    	let ellipse;
    	let g2;
    	let path1;
    	let circle2;
    	let path2;
    	let g3;
    	let path3;
    	let path4;

    	const block = {
    		c: function create() {
    			defs = svg_element("defs");
    			path0 = svg_element("path");
    			mask = svg_element("mask");
    			circle0 = svg_element("circle");
    			g1 = svg_element("g");
    			circle1 = svg_element("circle");
    			g0 = svg_element("g");
    			ellipse = svg_element("ellipse");
    			g2 = svg_element("g");
    			path1 = svg_element("path");
    			circle2 = svg_element("circle");
    			path2 = svg_element("path");
    			g3 = svg_element("g");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			attr_dev(path0, "id", "hand-path");
    			attr_dev(path0, "transform", "rotate(135) translate(-1490, -1830)");
    			attr_dev(path0, "d", "M1489.31 1930.06 C1505.15 1934.06 1525.37 1883.67 1533.5 1857.98L1455.85 1782.43C1434.44 1796.54 1391.79 1828.59 1392.48 1843.85C1393.17 1859.12 1422.49 1849.1 1437.06 1842.18C1423.36 1851.95 1398.44 1874.94 1408.3 1888.77C1418.16 1902.59 1444.36 1881.39 1456.23 1869.06C1447.13 1879.03 1429.5 1903.54 1431.85 1921.79C1434.21 1940.04 1466.81 1910.96 1482.81 1894.14C1478.38 1904.44 1473.48 1926.05 1489.31 1930.06Z");
    			attr_dev(path0, "fill", "var(--yellow)");
    			add_location(path0, file$6, 1, 2, 9);
    			attr_dev(circle0, "cx", "-3.5");
    			attr_dev(circle0, "cy", "-305");
    			attr_dev(circle0, "r", "181");
    			attr_dev(circle0, "fill", "var(--yellow)");
    			add_location(circle0, file$6, 17, 4, 687);
    			attr_dev(mask, "id", "mask0");
    			attr_dev(mask, "mask-type", "alpha");
    			attr_dev(mask, "maskUnits", "userSpaceOnUse");
    			attr_dev(mask, "x", "-185");
    			attr_dev(mask, "y", "-486");
    			attr_dev(mask, "width", "363");
    			attr_dev(mask, "height", "362");
    			add_location(mask, file$6, 8, 2, 544);
    			attr_dev(circle1, "cx", "-3.5");
    			attr_dev(circle1, "cy", "-305");
    			attr_dev(circle1, "r", "181");
    			attr_dev(circle1, "fill", "var(--yellow)");
    			attr_dev(circle1, "id", "neck");
    			add_location(circle1, file$6, 26, 4, 810);
    			attr_dev(ellipse, "cx", "74");
    			attr_dev(ellipse, "cy", "-406");
    			attr_dev(ellipse, "rx", "256");
    			attr_dev(ellipse, "ry", "134");
    			attr_dev(ellipse, "id", "neck-shadow");
    			attr_dev(ellipse, "fill", "var(--orange)");
    			add_location(ellipse, file$6, 35, 6, 950);
    			attr_dev(g0, "mask", "url(#mask0)");
    			add_location(g0, file$6, 34, 4, 921);
    			attr_dev(g1, "id", "torso1");
    			add_location(g1, file$6, 25, 2, 790);
    			attr_dev(path1, "d", "M223.207 141.853C223.207 162.268 169.214 167.852 119.715 176.853C41.0058 191.166 38.7167 263.726 38.7167 263.726L200 263.726C251 263.726 259 254.5 259 254.5L264.5 263.726L381.425 263.726C381.425 263.726 360.762 159.783 361 136.5C361 136.5 223.207 121.438 223.207 141.853Z");
    			attr_dev(path1, "fill", "var(--black)");
    			add_location(path1, file$6, 47, 4, 1200);
    			attr_dev(circle2, "cx", "292.801");
    			attr_dev(circle2, "cy", "130.736");
    			attr_dev(circle2, "r", "69");
    			attr_dev(circle2, "fill", "var(--black)");
    			add_location(circle2, file$6, 48, 4, 1509);
    			attr_dev(path2, "d", "M221.338 154.767C209.301 155.434 185.818 152.854 187.394 135.195C188.923 118.072 210.314 140.622 221.338 154.767ZM221.338 154.767C232.566 142.983 256.141 124.346 259.833 142.06C263.524 159.774 235.979 158.181 221.338 154.767ZM221.338 154.767L207.5 108.5M221.338 154.767L242 114");
    			attr_dev(path2, "stroke", "var(--yellow)");
    			attr_dev(path2, "stroke-width", "10");
    			add_location(path2, file$6, 49, 4, 1576);
    			attr_dev(g2, "fill", "var(--black)");
    			attr_dev(g2, "id", "foot");
    			attr_dev(g2, "transform", "scale(1) translate(-292.801, -123.735)");
    			add_location(g2, file$6, 46, 2, 1111);
    			attr_dev(path3, "d", "M 50 201 L 20 14 L 170 14 L 150 200 Z");
    			attr_dev(path3, "fill", "var(--blue)");
    			add_location(path3, file$6, 53, 4, 1983);
    			attr_dev(path4, "d", "M16.8599 135.82H170.86L162.83 203.458H24.8301L16.8599 135.82Z");
    			attr_dev(path4, "fill", "var(--black)");
    			add_location(path4, file$6, 54, 4, 2056);
    			attr_dev(g3, "id", "ankle");
    			attr_dev(g3, "transform", "scale(1) translate(-95, -200)");
    			add_location(g3, file$6, 52, 2, 1921);
    			add_location(defs, file$6, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, defs, anchor);
    			append_dev(defs, path0);
    			append_dev(defs, mask);
    			append_dev(mask, circle0);
    			append_dev(defs, g1);
    			append_dev(g1, circle1);
    			append_dev(g1, g0);
    			append_dev(g0, ellipse);
    			append_dev(defs, g2);
    			append_dev(g2, path1);
    			append_dev(g2, circle2);
    			append_dev(g2, path2);
    			append_dev(defs, g3);
    			append_dev(g3, path3);
    			append_dev(g3, path4);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(defs);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Defs', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Defs> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Defs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Defs",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/components/Arm.svelte generated by Svelte v3.59.2 */
    const file$5 = "src/components/Arm.svelte";

    function create_fragment$5(ctx) {
    	let g;
    	let use;
    	let g_transform_value;
    	let t;
    	let path;
    	let path_d_value;

    	const block = {
    		c: function create() {
    			g = svg_element("g");
    			use = svg_element("use");
    			t = space();
    			path = svg_element("path");
    			attr_dev(use, "href", "#hand-path");
    			add_location(use, file$5, 15, 2, 455);
    			attr_dev(g, "transform", g_transform_value = "translate(" + /*arm*/ ctx[0][0].x + ", " + /*arm*/ ctx[0][0].y + ") rotate(" + /*angle*/ ctx[2] + ")");
    			add_location(g, file$5, 14, 0, 387);
    			attr_dev(path, "d", path_d_value = "" + (move(/*arm*/ ctx[0][0]) + " " + cubic(.../*armControlPoints*/ ctx[1])));
    			attr_dev(path, "stroke", "var(--blue)");
    			attr_dev(path, "stroke-width", "180");
    			add_location(path, file$5, 17, 0, 486);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, g, anchor);
    			append_dev(g, use);
    			insert_dev(target, t, anchor);
    			insert_dev(target, path, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*arm, angle*/ 5 && g_transform_value !== (g_transform_value = "translate(" + /*arm*/ ctx[0][0].x + ", " + /*arm*/ ctx[0][0].y + ") rotate(" + /*angle*/ ctx[2] + ")")) {
    				attr_dev(g, "transform", g_transform_value);
    			}

    			if (dirty & /*arm, armControlPoints*/ 3 && path_d_value !== (path_d_value = "" + (move(/*arm*/ ctx[0][0]) + " " + cubic(.../*armControlPoints*/ ctx[1])))) {
    				attr_dev(path, "d", path_d_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(g);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(path);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let armControlPoints;
    	let angle_rad;
    	let angle;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Arm', slots, []);
    	let { arm } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (arm === undefined && !('arm' in $$props || $$self.$$.bound[$$self.$$.props['arm']])) {
    			console.warn("<Arm> was created without expected prop 'arm'");
    		}
    	});

    	const writable_props = ['arm'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Arm> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('arm' in $$props) $$invalidate(0, arm = $$props.arm);
    	};

    	$$self.$capture_state = () => ({
    		createSmoothControlPoints,
    		angleTo,
    		minus,
    		move,
    		cubic,
    		arm,
    		angle_rad,
    		angle,
    		armControlPoints
    	});

    	$$self.$inject_state = $$props => {
    		if ('arm' in $$props) $$invalidate(0, arm = $$props.arm);
    		if ('angle_rad' in $$props) $$invalidate(3, angle_rad = $$props.angle_rad);
    		if ('angle' in $$props) $$invalidate(2, angle = $$props.angle);
    		if ('armControlPoints' in $$props) $$invalidate(1, armControlPoints = $$props.armControlPoints);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*arm*/ 1) {
    			$$invalidate(1, armControlPoints = createSmoothControlPoints(arm[0], arm[1], arm[2]));
    		}

    		if ($$self.$$.dirty & /*arm, armControlPoints*/ 3) {
    			$$invalidate(3, angle_rad = -angleTo(minus(arm[0], armControlPoints[0]), { x: 0, y: -1 }));
    		}

    		if ($$self.$$.dirty & /*angle_rad*/ 8) {
    			$$invalidate(2, angle = angle_rad / Math.PI * 180);
    		}
    	};

    	return [arm, armControlPoints, angle, angle_rad];
    }

    class Arm extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$5, create_fragment$5, safe_not_equal, { arm: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Arm",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get arm() {
    		throw new Error("<Arm>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set arm(value) {
    		throw new Error("<Arm>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Controls.svelte generated by Svelte v3.59.2 */
    const file$4 = "src/components/Controls.svelte";

    function create_fragment$4(ctx) {
    	let svg;
    	let g2;
    	let g0;
    	let rect0;
    	let rect1;
    	let rect2;
    	let rect3;
    	let rect4;
    	let rect5;
    	let rect6;
    	let rect7;
    	let rect8;
    	let g1;
    	let path0;
    	let path1;
    	let path2;
    	let path3;
    	let path4;
    	let path5;
    	let path6;
    	let path7;
    	let circle;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			g2 = svg_element("g");
    			g0 = svg_element("g");
    			rect0 = svg_element("rect");
    			rect1 = svg_element("rect");
    			rect2 = svg_element("rect");
    			rect3 = svg_element("rect");
    			rect4 = svg_element("rect");
    			rect5 = svg_element("rect");
    			rect6 = svg_element("rect");
    			rect7 = svg_element("rect");
    			rect8 = svg_element("rect");
    			g1 = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			path5 = svg_element("path");
    			path6 = svg_element("path");
    			path7 = svg_element("path");
    			circle = svg_element("circle");
    			attr_dev(rect0, "class", "control svelte-1trrw6y");
    			attr_dev(rect0, "width", "278");
    			attr_dev(rect0, "height", "278");
    			attr_dev(rect0, "rx", "95");
    			add_location(rect0, file$4, 73, 6, 1721);
    			attr_dev(rect1, "class", "control svelte-1trrw6y");
    			attr_dev(rect1, "x", "313");
    			attr_dev(rect1, "width", "275");
    			attr_dev(rect1, "height", "278");
    			attr_dev(rect1, "rx", "95");
    			add_location(rect1, file$4, 74, 6, 1785);
    			attr_dev(rect2, "class", "control svelte-1trrw6y");
    			attr_dev(rect2, "x", "626");
    			attr_dev(rect2, "width", "278");
    			attr_dev(rect2, "height", "278");
    			attr_dev(rect2, "rx", "95");
    			add_location(rect2, file$4, 75, 6, 1857);
    			attr_dev(rect3, "class", "control svelte-1trrw6y");
    			attr_dev(rect3, "y", "314");
    			attr_dev(rect3, "width", "278");
    			attr_dev(rect3, "height", "278");
    			attr_dev(rect3, "rx", "95");
    			add_location(rect3, file$4, 76, 6, 1929);
    			attr_dev(rect4, "class", "control svelte-1trrw6y");
    			attr_dev(rect4, "x", "313");
    			attr_dev(rect4, "y", "314");
    			attr_dev(rect4, "width", "275");
    			attr_dev(rect4, "height", "278");
    			attr_dev(rect4, "rx", "95");
    			add_location(rect4, file$4, 77, 6, 2001);
    			attr_dev(rect5, "class", "control svelte-1trrw6y");
    			attr_dev(rect5, "x", "626");
    			attr_dev(rect5, "y", "314");
    			attr_dev(rect5, "width", "278");
    			attr_dev(rect5, "height", "278");
    			attr_dev(rect5, "rx", "95");
    			add_location(rect5, file$4, 78, 6, 2081);
    			attr_dev(rect6, "class", "control svelte-1trrw6y");
    			attr_dev(rect6, "y", "628");
    			attr_dev(rect6, "width", "278");
    			attr_dev(rect6, "height", "278");
    			attr_dev(rect6, "rx", "95");
    			add_location(rect6, file$4, 79, 6, 2161);
    			attr_dev(rect7, "class", "control svelte-1trrw6y");
    			attr_dev(rect7, "x", "313");
    			attr_dev(rect7, "y", "628");
    			attr_dev(rect7, "width", "275");
    			attr_dev(rect7, "height", "278");
    			attr_dev(rect7, "rx", "95");
    			add_location(rect7, file$4, 80, 6, 2233);
    			attr_dev(rect8, "class", "control svelte-1trrw6y");
    			attr_dev(rect8, "x", "626");
    			attr_dev(rect8, "y", "628");
    			attr_dev(rect8, "width", "278");
    			attr_dev(rect8, "height", "278");
    			attr_dev(rect8, "rx", "95");
    			add_location(rect8, file$4, 81, 6, 2313);
    			attr_dev(g0, "id", "controls");
    			attr_dev(g0, "fill", "var(--blue)");
    			attr_dev(g0, "stroke-width", "125");
    			attr_dev(g0, "stroke", "#00000001");
    			add_location(g0, file$4, 61, 4, 1427);
    			attr_dev(path0, "d", "M208.544 133.5L117.044 214L84.5437 79L208.544 133.5Z");
    			add_location(path0, file$4, 85, 6, 2464);
    			attr_dev(path1, "d", "M187.983 394.934L187.644 516.804L65 451.691L187.983 394.934Z");
    			add_location(path1, file$4, 86, 6, 2536);
    			attr_dev(path2, "d", "M396.157 725.29L518.027 725.629L452.914 848.273L396.157 725.29Z");
    			add_location(path2, file$4, 87, 6, 2616);
    			attr_dev(path3, "d", "M394.157 180.983L516.027 180.644L450.914 58L394.157 180.983Z");
    			add_location(path3, file$4, 88, 6, 2699);
    			attr_dev(path4, "d", "M718.335 393.112L718.673 514.983L841.318 449.87L718.335 393.112Z");
    			add_location(path4, file$4, 89, 6, 2779);
    			attr_dev(path5, "d", "M698.044 126.5L789.544 207L822.044 72L698.044 126.5Z");
    			add_location(path5, file$4, 90, 6, 2863);
    			attr_dev(path6, "d", "M208.044 779.5L116.544 699L84.0437 834L208.044 779.5Z");
    			add_location(path6, file$4, 91, 6, 2935);
    			attr_dev(path7, "d", "M697.544 786.5L789.044 706L821.544 841L697.544 786.5Z");
    			add_location(path7, file$4, 92, 6, 3008);
    			attr_dev(circle, "cx", "453.044");
    			attr_dev(circle, "cy", "453");
    			attr_dev(circle, "r", "50");
    			add_location(circle, file$4, 93, 6, 3081);
    			attr_dev(g1, "fill", "var(--white)");
    			set_style(g1, "pointer-events", "none");
    			add_location(g1, file$4, 84, 4, 2405);
    			attr_dev(g2, "id", "control_wrapper");
    			add_location(g2, file$4, 60, 2, 1398);
    			attr_dev(svg, "id", "controls_svg");
    			attr_dev(svg, "viewBox", "-75 0 982 909");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "class", "svelte-1trrw6y");
    			add_location(svg, file$4, 54, 0, 1301);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, g2);
    			append_dev(g2, g0);
    			append_dev(g0, rect0);
    			append_dev(g0, rect1);
    			append_dev(g0, rect2);
    			append_dev(g0, rect3);
    			append_dev(g0, rect4);
    			append_dev(g0, rect5);
    			append_dev(g0, rect6);
    			append_dev(g0, rect7);
    			append_dev(g0, rect8);
    			/*g0_binding*/ ctx[5](g0);
    			append_dev(g2, g1);
    			append_dev(g1, path0);
    			append_dev(g1, path1);
    			append_dev(g1, path2);
    			append_dev(g1, path3);
    			append_dev(g1, path4);
    			append_dev(g1, path5);
    			append_dev(g1, path6);
    			append_dev(g1, path7);
    			append_dev(g1, circle);

    			if (!mounted) {
    				dispose = [
    					listen_dev(g0, "mouseenter", /*enter*/ ctx[3], true, false, false, false),
    					listen_dev(g0, "touchstart", /*enter*/ ctx[3], true, false, false, false),
    					listen_dev(g0, "mouseleave", /*leave*/ ctx[1], false, false, false, false),
    					listen_dev(g0, "touchend", /*leave*/ ctx[1], { passive: true }, false, false, false),
    					listen_dev(g0, "touchmove", /*touchMove*/ ctx[2], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			/*g0_binding*/ ctx[5](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Controls', slots, []);
    	let { move } = $$props;
    	let controls;

    	function clearActive() {
    		Array.from(controls.children).forEach(el_ch => {
    			el_ch.classList.remove('active');
    		});
    	}

    	function leave() {
    		move(0);
    		clearActive();
    	}

    	function touchMove(ev) {
    		ev.preventDefault();
    		const { clientX, clientY } = ev.touches[0];
    		const g = ev.currentTarget;
    		const { x, y, width, height } = g.getBoundingClientRect();
    		const i = clamp(0, Math.floor((clientX - x) / width * 3), 2);
    		const j = clamp(0, Math.floor((clientY - y) / height * 3), 2);
    		clearActive();
    		const ix = j + j + j + i;
    		controls.children[ix].classList.add('active');
    		move(1 + ix);
    	}

    	function enter(ev) {
    		ev.preventDefault();
    		const currentTarget = ev.currentTarget;
    		const target = Array.from(currentTarget.children).indexOf(ev.target);
    		clearActive();

    		if (target >= 0) {
    			move(target + 1);
    			controls.children[target].classList.add('active');
    		}

    		return false;
    	}

    	$$self.$$.on_mount.push(function () {
    		if (move === undefined && !('move' in $$props || $$self.$$.bound[$$self.$$.props['move']])) {
    			console.warn("<Controls> was created without expected prop 'move'");
    		}
    	});

    	const writable_props = ['move'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Controls> was created with unknown prop '${key}'`);
    	});

    	function g0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			controls = $$value;
    			$$invalidate(0, controls);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('move' in $$props) $$invalidate(4, move = $$props.move);
    	};

    	$$self.$capture_state = () => ({
    		clamp,
    		move,
    		controls,
    		clearActive,
    		leave,
    		touchMove,
    		enter
    	});

    	$$self.$inject_state = $$props => {
    		if ('move' in $$props) $$invalidate(4, move = $$props.move);
    		if ('controls' in $$props) $$invalidate(0, controls = $$props.controls);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [controls, leave, touchMove, enter, move, g0_binding];
    }

    class Controls extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$4, create_fragment$4, safe_not_equal, { move: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Controls",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get move() {
    		throw new Error("<Controls>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set move(value) {
    		throw new Error("<Controls>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Hi.svelte generated by Svelte v3.59.2 */

    const file$3 = "src/components/Hi.svelte";

    function create_fragment$3(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let p;
    	let em0;
    	let t3;
    	let em1;
    	let t5;
    	let em2;
    	let t7;
    	let em3;
    	let t9;
    	let em4;
    	let t11;
    	let t12;
    	let div;
    	let a0;
    	let h30;
    	let t14;
    	let a1;
    	let h31;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Hi! I'm Bhavesh Kumar";
    			t1 = space();
    			p = element("p");
    			em0 = element("em");
    			em0.textContent = "Full-stack";
    			t3 = text(" developer. ");
    			em1 = element("em");
    			em1.textContent = "Functional programming";
    			t5 = text(" enthusiast. Building cool things for the ");
    			em2 = element("em");
    			em2.textContent = "web";
    			t7 = text(".\n    I'm currently ");
    			em3 = element("em");
    			em3.textContent = "available";
    			t9 = text(" for ");
    			em4 = element("em");
    			em4.textContent = "remote";
    			t11 = text(" full-time\n    and freelance work.");
    			t12 = space();
    			div = element("div");
    			a0 = element("a");
    			h30 = element("h3");
    			h30.textContent = "Contact Me";
    			t14 = space();
    			a1 = element("a");
    			h31 = element("h3");
    			h31.textContent = "Get my Resume";
    			attr_dev(h1, "class", "svelte-1h0tztb");
    			add_location(h1, file$3, 94, 2, 1605);
    			attr_dev(em0, "class", "svelte-1h0tztb");
    			add_location(em0, file$3, 96, 4, 1646);
    			attr_dev(em1, "class", "svelte-1h0tztb");
    			add_location(em1, file$3, 96, 35, 1677);
    			attr_dev(em2, "class", "svelte-1h0tztb");
    			add_location(em2, file$3, 96, 108, 1750);
    			attr_dev(em3, "class", "svelte-1h0tztb");
    			add_location(em3, file$3, 97, 18, 1782);
    			attr_dev(em4, "class", "svelte-1h0tztb");
    			add_location(em4, file$3, 97, 41, 1805);
    			attr_dev(p, "class", "svelte-1h0tztb");
    			add_location(p, file$3, 95, 2, 1638);
    			attr_dev(h30, "id", "contact");
    			attr_dev(h30, "class", "svelte-1h0tztb");
    			add_location(h30, file$3, 108, 6, 2182);
    			attr_dev(a0, "href", "mailto:Bhavkumar21@gmail.com");
    			attr_dev(a0, "class", "svelte-1h0tztb");
    			add_location(a0, file$3, 101, 4, 1895);
    			attr_dev(h31, "id", "resume");
    			attr_dev(h31, "class", "svelte-1h0tztb");
    			add_location(h31, file$3, 120, 6, 2530);
    			attr_dev(a1, "href", "/Bhavesh_Resume.pdf");
    			attr_dev(a1, "class", "svelte-1h0tztb");
    			add_location(a1, file$3, 112, 4, 2244);
    			attr_dev(div, "id", "contact_wrapper");
    			attr_dev(div, "class", "svelte-1h0tztb");
    			add_location(div, file$3, 100, 2, 1864);
    			attr_dev(main, "class", "svelte-1h0tztb");
    			add_location(main, file$3, 93, 0, 1596);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, p);
    			append_dev(p, em0);
    			append_dev(p, t3);
    			append_dev(p, em1);
    			append_dev(p, t5);
    			append_dev(p, em2);
    			append_dev(p, t7);
    			append_dev(p, em3);
    			append_dev(p, t9);
    			append_dev(p, em4);
    			append_dev(p, t11);
    			append_dev(main, t12);
    			append_dev(main, div);
    			append_dev(div, a0);
    			append_dev(a0, h30);
    			append_dev(div, t14);
    			append_dev(div, a1);
    			append_dev(a1, h31);

    			if (!mounted) {
    				dispose = [
    					listen_dev(a0, "mouseenter", /*mouseenter_handler*/ ctx[1], false, false, false, false),
    					listen_dev(a0, "mouseleave", /*mouseleave_handler*/ ctx[2], false, false, false, false),
    					listen_dev(a0, "touchstart", /*touchstart_handler*/ ctx[3], { passive: true }, false, false, false),
    					listen_dev(a0, "touchend", /*touchend_handler*/ ctx[4], { passive: true }, false, false, false),
    					listen_dev(a0, "touchcancel", /*touchcancel_handler*/ ctx[5], { passive: true }, false, false, false),
    					listen_dev(a1, "mouseenter", /*mouseenter_handler_1*/ ctx[6], false, false, false, false),
    					listen_dev(a1, "mouseleave", /*mouseleave_handler_1*/ ctx[7], false, false, false, false),
    					listen_dev(a1, "touchstart", /*touchstart_handler_1*/ ctx[8], { passive: true }, false, false, false),
    					listen_dev(a1, "touchend", /*touchend_handler_1*/ ctx[9], { passive: true }, false, false, false),
    					listen_dev(a1, "touchcancel", /*touchcancel_handler_1*/ ctx[10], { passive: true }, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Hi', slots, []);
    	let { excited } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (excited === undefined && !('excited' in $$props || $$self.$$.bound[$$self.$$.props['excited']])) {
    			console.warn("<Hi> was created without expected prop 'excited'");
    		}
    	});

    	const writable_props = ['excited'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Hi> was created with unknown prop '${key}'`);
    	});

    	const mouseenter_handler = () => {
    		excited.set(true);
    	};

    	const mouseleave_handler = () => excited.set(false);
    	const touchstart_handler = () => excited.set(true);
    	const touchend_handler = () => excited.set(false);
    	const touchcancel_handler = () => excited.set(false);

    	const mouseenter_handler_1 = () => {
    		excited.set(true);
    	};

    	const mouseleave_handler_1 = () => excited.set(false);
    	const touchstart_handler_1 = () => excited.set(true);
    	const touchend_handler_1 = () => excited.set(false);
    	const touchcancel_handler_1 = () => excited.set(false);

    	$$self.$$set = $$props => {
    		if ('excited' in $$props) $$invalidate(0, excited = $$props.excited);
    	};

    	$$self.$capture_state = () => ({ excited });

    	$$self.$inject_state = $$props => {
    		if ('excited' in $$props) $$invalidate(0, excited = $$props.excited);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		excited,
    		mouseenter_handler,
    		mouseleave_handler,
    		touchstart_handler,
    		touchend_handler,
    		touchcancel_handler,
    		mouseenter_handler_1,
    		mouseleave_handler_1,
    		touchstart_handler_1,
    		touchend_handler_1,
    		touchcancel_handler_1
    	];
    }

    class Hi extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$3, create_fragment$3, safe_not_equal, { excited: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Hi",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get excited() {
    		throw new Error("<Hi>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set excited(value) {
    		throw new Error("<Hi>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Nav.svelte generated by Svelte v3.59.2 */

    const file$2 = "src/components/Nav.svelte";

    function create_fragment$2(ctx) {
    	let nav;
    	let a0;
    	let svg0;
    	let path0;
    	let t0;
    	let a1;
    	let svg1;
    	let path1;
    	let t1;
    	let a2;
    	let svg2;
    	let path2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			a0 = element("a");
    			svg0 = svg_element("svg");
    			path0 = svg_element("path");
    			t0 = space();
    			a1 = element("a");
    			svg1 = svg_element("svg");
    			path1 = svg_element("path");
    			t1 = space();
    			a2 = element("a");
    			svg2 = svg_element("svg");
    			path2 = svg_element("path");
    			attr_dev(path0, "d", "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22");
    			add_location(path0, file$2, 55, 6, 1114);
    			attr_dev(svg0, "viewBox", "0 0 24 24");
    			attr_dev(svg0, "preserveAspectRatio", "xMidYMid");
    			attr_dev(svg0, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg0, "stroke", "currentColor");
    			attr_dev(svg0, "fill", "none");
    			attr_dev(svg0, "stroke-width", "2");
    			attr_dev(svg0, "stroke-linecap", "round");
    			attr_dev(svg0, "stroke-linejoin", "round");
    			attr_dev(svg0, "class", "svelte-1wg61k6");
    			add_location(svg0, file$2, 45, 4, 863);
    			attr_dev(a0, "href", "https://github.com/Bhavkumar21");
    			add_location(a0, file$2, 44, 2, 817);
    			attr_dev(path1, "d", "M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z");
    			add_location(path1, file$2, 70, 6, 1745);
    			attr_dev(svg1, "viewBox", "0 0 24 24");
    			attr_dev(svg1, "preserveAspectRatio", "xMidYMid");
    			attr_dev(svg1, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg1, "stroke", "currentColor");
    			attr_dev(svg1, "fill", "none");
    			attr_dev(svg1, "stroke-width", "2");
    			attr_dev(svg1, "stroke-linecap", "round");
    			attr_dev(svg1, "stroke-linejoin", "round");
    			attr_dev(svg1, "class", "svelte-1wg61k6");
    			add_location(svg1, file$2, 60, 4, 1496);
    			attr_dev(a1, "href", "https://www.linkedin.com/in/bhavkumar/");
    			add_location(a1, file$2, 59, 2, 1442);
    			attr_dev(path2, "d", "M18.825 23.859c-.022.092-.117.141-.281.141h-3.139c-.187 0-.351-.082-.492-.248l-5.178-6.589-1.448 1.374v5.111c0 .235-.117.352-.351.352H5.505c-.236 0-.354-.117-.354-.352V.353c0-.233.118-.353.354-.353h2.431c.234 0 .351.12.351.353v14.343l6.203-6.272c.165-.165.33-.246.495-.246h3.239c.144 0 .236.06.285.18.046.149.034.255-.036.315l-6.555 6.344 6.836 8.507c.095.104.117.208.07.358");
    			add_location(path2, file$2, 85, 6, 2324);
    			attr_dev(svg2, "viewBox", "0 0 24 24");
    			attr_dev(svg2, "preserveAspectRatio", "xMidYMid");
    			attr_dev(svg2, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg2, "stroke", "currentColor");
    			attr_dev(svg2, "fill", "none");
    			attr_dev(svg2, "stroke-width", "2");
    			attr_dev(svg2, "stroke-linecap", "round");
    			attr_dev(svg2, "stroke-linejoin", "round");
    			attr_dev(svg2, "class", "svelte-1wg61k6");
    			add_location(svg2, file$2, 75, 4, 2075);
    			attr_dev(a2, "href", "https://www.kaggle.com/bhavkumar");
    			add_location(a2, file$2, 74, 2, 2027);
    			attr_dev(nav, "class", "svelte-1wg61k6");
    			add_location(nav, file$2, 37, 0, 577);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, a0);
    			append_dev(a0, svg0);
    			append_dev(svg0, path0);
    			append_dev(nav, t0);
    			append_dev(nav, a1);
    			append_dev(a1, svg1);
    			append_dev(svg1, path1);
    			append_dev(nav, t1);
    			append_dev(nav, a2);
    			append_dev(a2, svg2);
    			append_dev(svg2, path2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(nav, "mouseenter", /*mouseenter_handler*/ ctx[1], false, false, false, false),
    					listen_dev(nav, "mouseleave", /*mouseleave_handler*/ ctx[2], false, false, false, false),
    					listen_dev(nav, "touchstart", /*touchstart_handler*/ ctx[3], { passive: true, capture: true }, false, false, false),
    					listen_dev(nav, "touchend", /*touchend_handler*/ ctx[4], { passive: true, capture: true }, false, false, false),
    					listen_dev(nav, "touchcancel", /*touchcancel_handler*/ ctx[5], { passive: true, capture: true }, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Nav', slots, []);
    	let { look } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (look === undefined && !('look' in $$props || $$self.$$.bound[$$self.$$.props['look']])) {
    			console.warn("<Nav> was created without expected prop 'look'");
    		}
    	});

    	const writable_props = ['look'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Nav> was created with unknown prop '${key}'`);
    	});

    	const mouseenter_handler = () => {
    		look.set(true);
    	};

    	const mouseleave_handler = () => look.set(false);
    	const touchstart_handler = () => look.set(true);
    	const touchend_handler = () => look.set(false);
    	const touchcancel_handler = () => look.set(false);

    	$$self.$$set = $$props => {
    		if ('look' in $$props) $$invalidate(0, look = $$props.look);
    	};

    	$$self.$capture_state = () => ({ look });

    	$$self.$inject_state = $$props => {
    		if ('look' in $$props) $$invalidate(0, look = $$props.look);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		look,
    		mouseenter_handler,
    		mouseleave_handler,
    		touchstart_handler,
    		touchend_handler,
    		touchcancel_handler
    	];
    }

    class Nav extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$2, create_fragment$2, safe_not_equal, { look: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Nav",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get look() {
    		throw new Error("<Nav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set look(value) {
    		throw new Error("<Nav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Bubble.svelte generated by Svelte v3.59.2 */
    const file$1 = "src/components/Bubble.svelte";

    function create_fragment$1(ctx) {
    	let g1;
    	let g0;
    	let path0;
    	let path1;
    	let path2;
    	let path3;
    	let path4;
    	let g0_class_value;
    	let g1_transform_value;

    	const block = {
    		c: function create() {
    			g1 = svg_element("g");
    			g0 = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			attr_dev(path0, "d", "M886.765 259.38C883.414 446.056 806.704 501.562 441.197 495.001C75.6898 488.44 1.26721 416.49 4.37178 243.541C7.99731 41.5705 74.6289 1.18269 449.94 7.91983C825.252 14.657 890.116 72.705 886.765 259.38Z");
    			add_location(path0, file$1, 29, 4, 620);
    			attr_dev(path1, "d", "M821.906 591.836C812.821 607.675 301.153 461.969 413.135 463.979C525.117 465.989 855.5 430 752.5 469.5C649.5 509 830.991 575.997 821.906 591.836Z");
    			add_location(path1, file$1, 32, 4, 850);
    			attr_dev(path2, "d", "M446 206.001C446 254.05 407.049 293.001 359 293.001C329.5 293.001 272 254.05 272 206.001C272 157.952 310.952 119.001 359 119.001C407.049 119.001 446 157.952 446 206.001Z");
    			attr_dev(path2, "fill", "var(--orange)");
    			add_location(path2, file$1, 35, 4, 1023);
    			attr_dev(path3, "d", "M610 206.001C610 254.05 540.5 293.001 523 293.001C474.951 293.001 436 254.05 436 206.001C436 157.952 474.951 119.001 523 119.001C571.049 119.001 610 157.952 610 206.001Z");
    			attr_dev(path3, "fill", "var(--orange)");
    			add_location(path3, file$1, 39, 4, 1247);
    			attr_dev(path4, "d", "M584 258.001L446 384.501L307 268.501L446 199.501L584 258.001Z");
    			attr_dev(path4, "fill", "var(--orange)");
    			add_location(path4, file$1, 43, 4, 1471);
    			attr_dev(g0, "id", "bubble");
    			attr_dev(g0, "class", g0_class_value = "" + (null_to_empty(/*excited*/ ctx[0] ? 'excited' : '') + " svelte-cymcyt"));
    			attr_dev(g0, "fill", "var(--shadow)");
    			add_location(g0, file$1, 28, 2, 544);
    			attr_dev(g1, "transform", g1_transform_value = "translate(" + /*head_p*/ ctx[1].x + " " + /*head_p*/ ctx[1].y + ") rotate(" + /*lean*/ ctx[2] + ") translate(0, -220)");
    			add_location(g1, file$1, 27, 0, 458);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, g1, anchor);
    			append_dev(g1, g0);
    			append_dev(g0, path0);
    			append_dev(g0, path1);
    			append_dev(g0, path2);
    			append_dev(g0, path3);
    			append_dev(g0, path4);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*excited*/ 1 && g0_class_value !== (g0_class_value = "" + (null_to_empty(/*excited*/ ctx[0] ? 'excited' : '') + " svelte-cymcyt"))) {
    				attr_dev(g0, "class", g0_class_value);
    			}

    			if (dirty & /*head_p, lean*/ 6 && g1_transform_value !== (g1_transform_value = "translate(" + /*head_p*/ ctx[1].x + " " + /*head_p*/ ctx[1].y + ") rotate(" + /*lean*/ ctx[2] + ") translate(0, -220)")) {
    				attr_dev(g1, "transform", g1_transform_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(g1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let lean;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Bubble', slots, []);
    	let { excited } = $$props;
    	let { head_p } = $$props;
    	let { lean_rad } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (excited === undefined && !('excited' in $$props || $$self.$$.bound[$$self.$$.props['excited']])) {
    			console.warn("<Bubble> was created without expected prop 'excited'");
    		}

    		if (head_p === undefined && !('head_p' in $$props || $$self.$$.bound[$$self.$$.props['head_p']])) {
    			console.warn("<Bubble> was created without expected prop 'head_p'");
    		}

    		if (lean_rad === undefined && !('lean_rad' in $$props || $$self.$$.bound[$$self.$$.props['lean_rad']])) {
    			console.warn("<Bubble> was created without expected prop 'lean_rad'");
    		}
    	});

    	const writable_props = ['excited', 'head_p', 'lean_rad'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Bubble> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('excited' in $$props) $$invalidate(0, excited = $$props.excited);
    		if ('head_p' in $$props) $$invalidate(1, head_p = $$props.head_p);
    		if ('lean_rad' in $$props) $$invalidate(3, lean_rad = $$props.lean_rad);
    	};

    	$$self.$capture_state = () => ({ spring, excited, head_p, lean_rad, lean });

    	$$self.$inject_state = $$props => {
    		if ('excited' in $$props) $$invalidate(0, excited = $$props.excited);
    		if ('head_p' in $$props) $$invalidate(1, head_p = $$props.head_p);
    		if ('lean_rad' in $$props) $$invalidate(3, lean_rad = $$props.lean_rad);
    		if ('lean' in $$props) $$invalidate(2, lean = $$props.lean);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*lean_rad*/ 8) {
    			$$invalidate(2, lean = -lean_rad / Math.PI * 180);
    		}
    	};

    	return [excited, head_p, lean, lean_rad];
    }

    class Bubble extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$1, create_fragment$1, safe_not_equal, { excited: 0, head_p: 1, lean_rad: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Bubble",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get excited() {
    		throw new Error("<Bubble>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set excited(value) {
    		throw new Error("<Bubble>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get head_p() {
    		throw new Error("<Bubble>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set head_p(value) {
    		throw new Error("<Bubble>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get lean_rad() {
    		throw new Error("<Bubble>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set lean_rad(value) {
    		throw new Error("<Bubble>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/App.svelte generated by Svelte v3.59.2 */
    const file = "src/components/App.svelte";

    function create_fragment(ctx) {
    	let div;
    	let header;
    	let t1;
    	let article;
    	let aside;
    	let bg;
    	let t2;
    	let svg;
    	let defs;
    	let g2;
    	let g1;
    	let g0;
    	let legs;
    	let torso;
    	let head;
    	let arm0;
    	let arm1;
    	let bubble_1;
    	let t3;
    	let controls;
    	let t4;
    	let hi;
    	let t5;
    	let nav;
    	let current;
    	bg = new Bg({ $$inline: true });
    	defs = new Defs({ $$inline: true });

    	legs = new Legs({
    			props: {
    				points_l: /*$limbs*/ ctx[2].leftLeg,
    				points_r: /*$limbs*/ ctx[2].rightLeg,
    				orientation_r: /*$orientation_r*/ ctx[6],
    				orientation_l: /*$orientation_l*/ ctx[7],
    				on_floor_l: /*pose*/ ctx[0].ON_FLOOR_L,
    				on_floor_r: /*pose*/ ctx[0].ON_FLOOR_R
    			},
    			$$inline: true
    		});

    	torso = new Torso({
    			props: {
    				torso_p: /*$limbs*/ ctx[2].torso[1],
    				lean_rad: /*lean_rad*/ ctx[1],
    				left: /*torso_l*/ ctx[5],
    				right: /*torso_r*/ ctx[4]
    			},
    			$$inline: true
    		});

    	head = new Head({
    			props: {
    				torso_p: /*$limbs*/ ctx[2].torso[1],
    				lean_rad: /*lean_rad*/ ctx[1],
    				dy: /*$dy*/ ctx[8]
    			},
    			$$inline: true
    		});

    	arm0 = new Arm({
    			props: { arm: /*$limbs*/ ctx[2].leftArm },
    			$$inline: true
    		});

    	arm1 = new Arm({
    			props: { arm: /*$limbs*/ ctx[2].rightArm },
    			$$inline: true
    		});

    	bubble_1 = new Bubble({
    			props: {
    				excited: /*$excited*/ ctx[3],
    				head_p: /*$limbs*/ ctx[2].torso[1],
    				lean_rad: /*lean_rad*/ ctx[1]
    			},
    			$$inline: true
    		});

    	controls = new Controls({
    			props: { move: /*move*/ ctx[9] },
    			$$inline: true
    		});

    	hi = new Hi({
    			props: { excited: /*excited*/ ctx[10] },
    			$$inline: true
    		});

    	nav = new Nav({
    			props: { look: /*look*/ ctx[11] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			header = element("header");
    			header.textContent = "Bhavesh Kumar";
    			t1 = space();
    			article = element("article");
    			aside = element("aside");
    			create_component(bg.$$.fragment);
    			t2 = space();
    			svg = svg_element("svg");
    			create_component(defs.$$.fragment);
    			g2 = svg_element("g");
    			g1 = svg_element("g");
    			g0 = svg_element("g");
    			create_component(legs.$$.fragment);
    			create_component(torso.$$.fragment);
    			create_component(head.$$.fragment);
    			create_component(arm0.$$.fragment);
    			create_component(arm1.$$.fragment);
    			create_component(bubble_1.$$.fragment);
    			t3 = space();
    			create_component(controls.$$.fragment);
    			t4 = space();
    			create_component(hi.$$.fragment);
    			t5 = space();
    			create_component(nav.$$.fragment);
    			attr_dev(header, "class", "svelte-1e2e5ff");
    			add_location(header, file, 121, 2, 3240);
    			attr_dev(g0, "id", "guy_group");
    			attr_dev(g0, "transform", "scale(0.9)");
    			add_location(g0, file, 135, 12, 3609);
    			attr_dev(g1, "transform", "translate(800 400)");
    			add_location(g1, file, 134, 10, 3562);
    			attr_dev(g2, "class", "svg_content");
    			add_location(g2, file, 133, 8, 3528);
    			attr_dev(svg, "id", "guy_svg");
    			attr_dev(svg, "viewBox", "-3750 -300 9140 4200");
    			attr_dev(svg, "preserveAspectRatio", "xMidYMin slice");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "class", "svelte-1e2e5ff");
    			add_location(svg, file, 125, 6, 3320);
    			add_location(aside, file, 123, 4, 3287);
    			add_location(article, file, 122, 2, 3273);
    			add_location(div, file, 120, 0, 3232);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, header);
    			append_dev(div, t1);
    			append_dev(div, article);
    			append_dev(article, aside);
    			mount_component(bg, aside, null);
    			append_dev(aside, t2);
    			append_dev(aside, svg);
    			mount_component(defs, svg, null);
    			append_dev(svg, g2);
    			append_dev(g2, g1);
    			append_dev(g1, g0);
    			mount_component(legs, g0, null);
    			mount_component(torso, g0, null);
    			mount_component(head, g0, null);
    			mount_component(arm0, g0, null);
    			mount_component(arm1, g0, null);
    			mount_component(bubble_1, g2, null);
    			append_dev(aside, t3);
    			mount_component(controls, aside, null);
    			append_dev(article, t4);
    			mount_component(hi, article, null);
    			append_dev(article, t5);
    			mount_component(nav, article, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const legs_changes = {};
    			if (dirty & /*$limbs*/ 4) legs_changes.points_l = /*$limbs*/ ctx[2].leftLeg;
    			if (dirty & /*$limbs*/ 4) legs_changes.points_r = /*$limbs*/ ctx[2].rightLeg;
    			if (dirty & /*$orientation_r*/ 64) legs_changes.orientation_r = /*$orientation_r*/ ctx[6];
    			if (dirty & /*$orientation_l*/ 128) legs_changes.orientation_l = /*$orientation_l*/ ctx[7];
    			if (dirty & /*pose*/ 1) legs_changes.on_floor_l = /*pose*/ ctx[0].ON_FLOOR_L;
    			if (dirty & /*pose*/ 1) legs_changes.on_floor_r = /*pose*/ ctx[0].ON_FLOOR_R;
    			legs.$set(legs_changes);
    			const torso_changes = {};
    			if (dirty & /*$limbs*/ 4) torso_changes.torso_p = /*$limbs*/ ctx[2].torso[1];
    			if (dirty & /*lean_rad*/ 2) torso_changes.lean_rad = /*lean_rad*/ ctx[1];
    			if (dirty & /*torso_l*/ 32) torso_changes.left = /*torso_l*/ ctx[5];
    			if (dirty & /*torso_r*/ 16) torso_changes.right = /*torso_r*/ ctx[4];
    			torso.$set(torso_changes);
    			const head_changes = {};
    			if (dirty & /*$limbs*/ 4) head_changes.torso_p = /*$limbs*/ ctx[2].torso[1];
    			if (dirty & /*lean_rad*/ 2) head_changes.lean_rad = /*lean_rad*/ ctx[1];
    			if (dirty & /*$dy*/ 256) head_changes.dy = /*$dy*/ ctx[8];
    			head.$set(head_changes);
    			const arm0_changes = {};
    			if (dirty & /*$limbs*/ 4) arm0_changes.arm = /*$limbs*/ ctx[2].leftArm;
    			arm0.$set(arm0_changes);
    			const arm1_changes = {};
    			if (dirty & /*$limbs*/ 4) arm1_changes.arm = /*$limbs*/ ctx[2].rightArm;
    			arm1.$set(arm1_changes);
    			const bubble_1_changes = {};
    			if (dirty & /*$excited*/ 8) bubble_1_changes.excited = /*$excited*/ ctx[3];
    			if (dirty & /*$limbs*/ 4) bubble_1_changes.head_p = /*$limbs*/ ctx[2].torso[1];
    			if (dirty & /*lean_rad*/ 2) bubble_1_changes.lean_rad = /*lean_rad*/ ctx[1];
    			bubble_1.$set(bubble_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(bg.$$.fragment, local);
    			transition_in(defs.$$.fragment, local);
    			transition_in(legs.$$.fragment, local);
    			transition_in(torso.$$.fragment, local);
    			transition_in(head.$$.fragment, local);
    			transition_in(arm0.$$.fragment, local);
    			transition_in(arm1.$$.fragment, local);
    			transition_in(bubble_1.$$.fragment, local);
    			transition_in(controls.$$.fragment, local);
    			transition_in(hi.$$.fragment, local);
    			transition_in(nav.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(bg.$$.fragment, local);
    			transition_out(defs.$$.fragment, local);
    			transition_out(legs.$$.fragment, local);
    			transition_out(torso.$$.fragment, local);
    			transition_out(head.$$.fragment, local);
    			transition_out(arm0.$$.fragment, local);
    			transition_out(arm1.$$.fragment, local);
    			transition_out(bubble_1.$$.fragment, local);
    			transition_out(controls.$$.fragment, local);
    			transition_out(hi.$$.fragment, local);
    			transition_out(nav.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(bg);
    			destroy_component(defs);
    			destroy_component(legs);
    			destroy_component(torso);
    			destroy_component(head);
    			destroy_component(arm0);
    			destroy_component(arm1);
    			destroy_component(bubble_1);
    			destroy_component(controls);
    			destroy_component(hi);
    			destroy_component(nav);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let i;
    	let pose;
    	let pose_data;
    	let skeleton;
    	let lean_rad;
    	let torso_l;
    	let torso_r;
    	let $limbs;
    	let $excited;
    	let $orientation_r;
    	let $orientation_l;
    	let $dy;
    	let $look;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let _i = 0;

    	function move(j) {
    		set_store_value(excited, $excited = false, $excited);
    		set_store_value(look, $look = false, $look);
    		$$invalidate(16, _i = j);
    	}

    	let excited = writable(false);
    	validate_store(excited, 'excited');
    	component_subscribe($$self, excited, value => $$invalidate(3, $excited = value));
    	let look = writable(false);
    	validate_store(look, 'look');
    	component_subscribe($$self, look, value => $$invalidate(19, $look = value));
    	let dy = spring(POSE_LIST[_i].HEAD);
    	validate_store(dy, 'dy');
    	component_subscribe($$self, dy, value => $$invalidate(8, $dy = value));
    	let orientation_l = spring(POSE_LIST[_i].LEG_ORIENTATION_L);
    	validate_store(orientation_l, 'orientation_l');
    	component_subscribe($$self, orientation_l, value => $$invalidate(7, $orientation_l = value));
    	let orientation_r = spring(POSE_LIST[_i].LEG_ORIENTATION_R);
    	validate_store(orientation_r, 'orientation_r');
    	component_subscribe($$self, orientation_r, value => $$invalidate(6, $orientation_r = value));
    	let limbs = spring(mkLimbs(POSES[_i].skeleton));
    	validate_store(limbs, 'limbs');
    	component_subscribe($$self, limbs, value => $$invalidate(2, $limbs = value));

    	function runDynamics(t) {
    		t = t / 128;
    		let swiggity = 35;
    		let swooty = 35;
    		let speed = t * 1.1;
    		let hand_r = pose_data.rightHand;
    		let hand_l = pose_data.leftHand;

    		if ($excited) {
    			speed = t * 3;

    			hand_r.target = plus(plus(PELVIS, pose.HAND_R), {
    				x: 100 * Math.sin(speed),
    				y: -60 * Math.cos(speed)
    			});

    			hand_l.target = plus(plus(PELVIS, pose.HAND_L), {
    				x: 100 * Math.cos(speed),
    				y: 60 * Math.sin(speed)
    			});
    		} else if (i === 11) {
    			speed = t / 2;
    			swiggity = 0;
    			swooty = 15;
    		} else if (i === 0) {
    			speed = t / 2;
    			swiggity = 0;
    			swooty = 45;
    			hand_l.target = plus(skeleton.target, { x: -400, y: 300 });

    			if (t < 30) {
    				hand_r.target = plus(plus(PELVIS, pose.HAND_R), {
    					x: 180 * Math.sin(t * 2),
    					y: 10 * Math.sin(t * 2)
    				});
    			} else {
    				hand_r.orientationConstraint = 1;
    				hand_r.target = plus(skeleton.target, { x: 350, y: 350 });
    			}
    		}

    		skeleton.target = plus(plus(PELVIS, pose.TORSO), {
    			x: Math.cos(speed) * swiggity,
    			y: Math.sin(speed) * swooty
    		});

    		set_store_value(limbs, $limbs = mkLimbs(FABRIK(skeleton, 10)), $limbs);
    		requestAnimationFrame(runDynamics);
    	}

    	requestAnimationFrame(runDynamics);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		spring,
    		writable,
    		mkLimbs,
    		FABRIK,
    		POSES,
    		POSE_LIST,
    		PELVIS,
    		plus,
    		minus,
    		angleTo,
    		scale,
    		rotate,
    		Torso,
    		Legs,
    		Head,
    		Bg,
    		Defs,
    		Arm,
    		Controls,
    		Hi,
    		Nav,
    		Bubble,
    		_i,
    		move,
    		excited,
    		look,
    		dy,
    		orientation_l,
    		orientation_r,
    		limbs,
    		runDynamics,
    		skeleton,
    		pose,
    		i,
    		pose_data,
    		lean_rad,
    		torso_r,
    		torso_l,
    		$limbs,
    		$excited,
    		$orientation_r,
    		$orientation_l,
    		$dy,
    		$look
    	});

    	$$self.$inject_state = $$props => {
    		if ('_i' in $$props) $$invalidate(16, _i = $$props._i);
    		if ('excited' in $$props) $$invalidate(10, excited = $$props.excited);
    		if ('look' in $$props) $$invalidate(11, look = $$props.look);
    		if ('dy' in $$props) $$invalidate(12, dy = $$props.dy);
    		if ('orientation_l' in $$props) $$invalidate(13, orientation_l = $$props.orientation_l);
    		if ('orientation_r' in $$props) $$invalidate(14, orientation_r = $$props.orientation_r);
    		if ('limbs' in $$props) $$invalidate(15, limbs = $$props.limbs);
    		if ('skeleton' in $$props) skeleton = $$props.skeleton;
    		if ('pose' in $$props) $$invalidate(0, pose = $$props.pose);
    		if ('i' in $$props) $$invalidate(17, i = $$props.i);
    		if ('pose_data' in $$props) $$invalidate(18, pose_data = $$props.pose_data);
    		if ('lean_rad' in $$props) $$invalidate(1, lean_rad = $$props.lean_rad);
    		if ('torso_r' in $$props) $$invalidate(4, torso_r = $$props.torso_r);
    		if ('torso_l' in $$props) $$invalidate(5, torso_l = $$props.torso_l);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$look, $excited, _i*/ 589832) {
    			$$invalidate(17, i = $look ? 11 : $excited ? 10 : _i);
    		}

    		if ($$self.$$.dirty & /*i*/ 131072) {
    			$$invalidate(0, pose = POSE_LIST[i]);
    		}

    		if ($$self.$$.dirty & /*pose*/ 1) {
    			set_store_value(dy, $dy = { x: pose.HEAD.x, y: pose.HEAD.y }, $dy);
    		}

    		if ($$self.$$.dirty & /*pose*/ 1) {
    			set_store_value(orientation_l, $orientation_l = pose.LEG_ORIENTATION_L, $orientation_l);
    		}

    		if ($$self.$$.dirty & /*pose*/ 1) {
    			set_store_value(orientation_r, $orientation_r = pose.LEG_ORIENTATION_R, $orientation_r);
    		}

    		if ($$self.$$.dirty & /*i*/ 131072) {
    			$$invalidate(18, pose_data = POSES[i]);
    		}

    		if ($$self.$$.dirty & /*pose_data*/ 262144) {
    			skeleton = pose_data.skeleton;
    		}

    		if ($$self.$$.dirty & /*$limbs*/ 4) {
    			$$invalidate(1, lean_rad = angleTo(minus($limbs.torso[0], $limbs.torso[1]), { x: 0, y: -1 }));
    		}

    		if ($$self.$$.dirty & /*$limbs, lean_rad*/ 6) {
    			$$invalidate(5, torso_l = rotate(scale(minus($limbs.leftLeg[2], $limbs.leftArm[2]), 0.8), lean_rad));
    		}

    		if ($$self.$$.dirty & /*$limbs, lean_rad*/ 6) {
    			$$invalidate(4, torso_r = rotate(scale(minus($limbs.rightLeg[2], $limbs.rightArm[2]), 0.8), lean_rad));
    		}
    	};

    	return [
    		pose,
    		lean_rad,
    		$limbs,
    		$excited,
    		torso_r,
    		torso_l,
    		$orientation_r,
    		$orientation_l,
    		$dy,
    		move,
    		excited,
    		look,
    		dy,
    		orientation_l,
    		orientation_r,
    		limbs,
    		_i,
    		i,
    		pose_data,
    		$look
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
