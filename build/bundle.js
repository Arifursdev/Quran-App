
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
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
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
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
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
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
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
    function beforeUpdate(fn) {
        get_current_component().$$.before_update.push(fn);
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
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
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
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

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
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
            ctx: null,
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
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.49.0' }, detail), { bubbles: true }));
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
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
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
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
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
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
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
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const data$1 = writable({
        currentSurah: window.outerWidth > 991 ? 1 : null,
        surah: [],
        chapters: []
    });

    var bind = function bind(fn, thisArg) {
      return function wrap() {
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }
        return fn.apply(thisArg, args);
      };
    };

    // utils is a library of generic helper functions non-specific to axios

    var toString = Object.prototype.toString;

    // eslint-disable-next-line func-names
    var kindOf = (function(cache) {
      // eslint-disable-next-line func-names
      return function(thing) {
        var str = toString.call(thing);
        return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
      };
    })(Object.create(null));

    function kindOfTest(type) {
      type = type.toLowerCase();
      return function isKindOf(thing) {
        return kindOf(thing) === type;
      };
    }

    /**
     * Determine if a value is an Array
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Array, otherwise false
     */
    function isArray(val) {
      return Array.isArray(val);
    }

    /**
     * Determine if a value is undefined
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if the value is undefined, otherwise false
     */
    function isUndefined(val) {
      return typeof val === 'undefined';
    }

    /**
     * Determine if a value is a Buffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Buffer, otherwise false
     */
    function isBuffer(val) {
      return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
        && typeof val.constructor.isBuffer === 'function' && val.constructor.isBuffer(val);
    }

    /**
     * Determine if a value is an ArrayBuffer
     *
     * @function
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an ArrayBuffer, otherwise false
     */
    var isArrayBuffer = kindOfTest('ArrayBuffer');


    /**
     * Determine if a value is a view on an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
     */
    function isArrayBufferView(val) {
      var result;
      if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
        result = ArrayBuffer.isView(val);
      } else {
        result = (val) && (val.buffer) && (isArrayBuffer(val.buffer));
      }
      return result;
    }

    /**
     * Determine if a value is a String
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a String, otherwise false
     */
    function isString(val) {
      return typeof val === 'string';
    }

    /**
     * Determine if a value is a Number
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Number, otherwise false
     */
    function isNumber(val) {
      return typeof val === 'number';
    }

    /**
     * Determine if a value is an Object
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Object, otherwise false
     */
    function isObject(val) {
      return val !== null && typeof val === 'object';
    }

    /**
     * Determine if a value is a plain Object
     *
     * @param {Object} val The value to test
     * @return {boolean} True if value is a plain Object, otherwise false
     */
    function isPlainObject(val) {
      if (kindOf(val) !== 'object') {
        return false;
      }

      var prototype = Object.getPrototypeOf(val);
      return prototype === null || prototype === Object.prototype;
    }

    /**
     * Determine if a value is a Date
     *
     * @function
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Date, otherwise false
     */
    var isDate = kindOfTest('Date');

    /**
     * Determine if a value is a File
     *
     * @function
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a File, otherwise false
     */
    var isFile = kindOfTest('File');

    /**
     * Determine if a value is a Blob
     *
     * @function
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Blob, otherwise false
     */
    var isBlob = kindOfTest('Blob');

    /**
     * Determine if a value is a FileList
     *
     * @function
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a File, otherwise false
     */
    var isFileList = kindOfTest('FileList');

    /**
     * Determine if a value is a Function
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Function, otherwise false
     */
    function isFunction(val) {
      return toString.call(val) === '[object Function]';
    }

    /**
     * Determine if a value is a Stream
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Stream, otherwise false
     */
    function isStream(val) {
      return isObject(val) && isFunction(val.pipe);
    }

    /**
     * Determine if a value is a FormData
     *
     * @param {Object} thing The value to test
     * @returns {boolean} True if value is an FormData, otherwise false
     */
    function isFormData(thing) {
      var pattern = '[object FormData]';
      return thing && (
        (typeof FormData === 'function' && thing instanceof FormData) ||
        toString.call(thing) === pattern ||
        (isFunction(thing.toString) && thing.toString() === pattern)
      );
    }

    /**
     * Determine if a value is a URLSearchParams object
     * @function
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a URLSearchParams object, otherwise false
     */
    var isURLSearchParams = kindOfTest('URLSearchParams');

    /**
     * Trim excess whitespace off the beginning and end of a string
     *
     * @param {String} str The String to trim
     * @returns {String} The String freed of excess whitespace
     */
    function trim(str) {
      return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
    }

    /**
     * Determine if we're running in a standard browser environment
     *
     * This allows axios to run in a web worker, and react-native.
     * Both environments support XMLHttpRequest, but not fully standard globals.
     *
     * web workers:
     *  typeof window -> undefined
     *  typeof document -> undefined
     *
     * react-native:
     *  navigator.product -> 'ReactNative'
     * nativescript
     *  navigator.product -> 'NativeScript' or 'NS'
     */
    function isStandardBrowserEnv() {
      if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
                                               navigator.product === 'NativeScript' ||
                                               navigator.product === 'NS')) {
        return false;
      }
      return (
        typeof window !== 'undefined' &&
        typeof document !== 'undefined'
      );
    }

    /**
     * Iterate over an Array or an Object invoking a function for each item.
     *
     * If `obj` is an Array callback will be called passing
     * the value, index, and complete array for each item.
     *
     * If 'obj' is an Object callback will be called passing
     * the value, key, and complete object for each property.
     *
     * @param {Object|Array} obj The object to iterate
     * @param {Function} fn The callback to invoke for each item
     */
    function forEach(obj, fn) {
      // Don't bother if no value provided
      if (obj === null || typeof obj === 'undefined') {
        return;
      }

      // Force an array if not already something iterable
      if (typeof obj !== 'object') {
        /*eslint no-param-reassign:0*/
        obj = [obj];
      }

      if (isArray(obj)) {
        // Iterate over array values
        for (var i = 0, l = obj.length; i < l; i++) {
          fn.call(null, obj[i], i, obj);
        }
      } else {
        // Iterate over object keys
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            fn.call(null, obj[key], key, obj);
          }
        }
      }
    }

    /**
     * Accepts varargs expecting each argument to be an object, then
     * immutably merges the properties of each object and returns result.
     *
     * When multiple objects contain the same key the later object in
     * the arguments list will take precedence.
     *
     * Example:
     *
     * ```js
     * var result = merge({foo: 123}, {foo: 456});
     * console.log(result.foo); // outputs 456
     * ```
     *
     * @param {Object} obj1 Object to merge
     * @returns {Object} Result of all merge properties
     */
    function merge(/* obj1, obj2, obj3, ... */) {
      var result = {};
      function assignValue(val, key) {
        if (isPlainObject(result[key]) && isPlainObject(val)) {
          result[key] = merge(result[key], val);
        } else if (isPlainObject(val)) {
          result[key] = merge({}, val);
        } else if (isArray(val)) {
          result[key] = val.slice();
        } else {
          result[key] = val;
        }
      }

      for (var i = 0, l = arguments.length; i < l; i++) {
        forEach(arguments[i], assignValue);
      }
      return result;
    }

    /**
     * Extends object a by mutably adding to it the properties of object b.
     *
     * @param {Object} a The object to be extended
     * @param {Object} b The object to copy properties from
     * @param {Object} thisArg The object to bind function to
     * @return {Object} The resulting value of object a
     */
    function extend(a, b, thisArg) {
      forEach(b, function assignValue(val, key) {
        if (thisArg && typeof val === 'function') {
          a[key] = bind(val, thisArg);
        } else {
          a[key] = val;
        }
      });
      return a;
    }

    /**
     * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
     *
     * @param {string} content with BOM
     * @return {string} content value without BOM
     */
    function stripBOM(content) {
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      return content;
    }

    /**
     * Inherit the prototype methods from one constructor into another
     * @param {function} constructor
     * @param {function} superConstructor
     * @param {object} [props]
     * @param {object} [descriptors]
     */

    function inherits(constructor, superConstructor, props, descriptors) {
      constructor.prototype = Object.create(superConstructor.prototype, descriptors);
      constructor.prototype.constructor = constructor;
      props && Object.assign(constructor.prototype, props);
    }

    /**
     * Resolve object with deep prototype chain to a flat object
     * @param {Object} sourceObj source object
     * @param {Object} [destObj]
     * @param {Function} [filter]
     * @returns {Object}
     */

    function toFlatObject(sourceObj, destObj, filter) {
      var props;
      var i;
      var prop;
      var merged = {};

      destObj = destObj || {};

      do {
        props = Object.getOwnPropertyNames(sourceObj);
        i = props.length;
        while (i-- > 0) {
          prop = props[i];
          if (!merged[prop]) {
            destObj[prop] = sourceObj[prop];
            merged[prop] = true;
          }
        }
        sourceObj = Object.getPrototypeOf(sourceObj);
      } while (sourceObj && (!filter || filter(sourceObj, destObj)) && sourceObj !== Object.prototype);

      return destObj;
    }

    /*
     * determines whether a string ends with the characters of a specified string
     * @param {String} str
     * @param {String} searchString
     * @param {Number} [position= 0]
     * @returns {boolean}
     */
    function endsWith(str, searchString, position) {
      str = String(str);
      if (position === undefined || position > str.length) {
        position = str.length;
      }
      position -= searchString.length;
      var lastIndex = str.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
    }


    /**
     * Returns new array from array like object
     * @param {*} [thing]
     * @returns {Array}
     */
    function toArray(thing) {
      if (!thing) return null;
      var i = thing.length;
      if (isUndefined(i)) return null;
      var arr = new Array(i);
      while (i-- > 0) {
        arr[i] = thing[i];
      }
      return arr;
    }

    // eslint-disable-next-line func-names
    var isTypedArray = (function(TypedArray) {
      // eslint-disable-next-line func-names
      return function(thing) {
        return TypedArray && thing instanceof TypedArray;
      };
    })(typeof Uint8Array !== 'undefined' && Object.getPrototypeOf(Uint8Array));

    var utils = {
      isArray: isArray,
      isArrayBuffer: isArrayBuffer,
      isBuffer: isBuffer,
      isFormData: isFormData,
      isArrayBufferView: isArrayBufferView,
      isString: isString,
      isNumber: isNumber,
      isObject: isObject,
      isPlainObject: isPlainObject,
      isUndefined: isUndefined,
      isDate: isDate,
      isFile: isFile,
      isBlob: isBlob,
      isFunction: isFunction,
      isStream: isStream,
      isURLSearchParams: isURLSearchParams,
      isStandardBrowserEnv: isStandardBrowserEnv,
      forEach: forEach,
      merge: merge,
      extend: extend,
      trim: trim,
      stripBOM: stripBOM,
      inherits: inherits,
      toFlatObject: toFlatObject,
      kindOf: kindOf,
      kindOfTest: kindOfTest,
      endsWith: endsWith,
      toArray: toArray,
      isTypedArray: isTypedArray,
      isFileList: isFileList
    };

    function encode(val) {
      return encodeURIComponent(val).
        replace(/%3A/gi, ':').
        replace(/%24/g, '$').
        replace(/%2C/gi, ',').
        replace(/%20/g, '+').
        replace(/%5B/gi, '[').
        replace(/%5D/gi, ']');
    }

    /**
     * Build a URL by appending params to the end
     *
     * @param {string} url The base of the url (e.g., http://www.google.com)
     * @param {object} [params] The params to be appended
     * @returns {string} The formatted url
     */
    var buildURL = function buildURL(url, params, paramsSerializer) {
      /*eslint no-param-reassign:0*/
      if (!params) {
        return url;
      }

      var serializedParams;
      if (paramsSerializer) {
        serializedParams = paramsSerializer(params);
      } else if (utils.isURLSearchParams(params)) {
        serializedParams = params.toString();
      } else {
        var parts = [];

        utils.forEach(params, function serialize(val, key) {
          if (val === null || typeof val === 'undefined') {
            return;
          }

          if (utils.isArray(val)) {
            key = key + '[]';
          } else {
            val = [val];
          }

          utils.forEach(val, function parseValue(v) {
            if (utils.isDate(v)) {
              v = v.toISOString();
            } else if (utils.isObject(v)) {
              v = JSON.stringify(v);
            }
            parts.push(encode(key) + '=' + encode(v));
          });
        });

        serializedParams = parts.join('&');
      }

      if (serializedParams) {
        var hashmarkIndex = url.indexOf('#');
        if (hashmarkIndex !== -1) {
          url = url.slice(0, hashmarkIndex);
        }

        url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
      }

      return url;
    };

    function InterceptorManager() {
      this.handlers = [];
    }

    /**
     * Add a new interceptor to the stack
     *
     * @param {Function} fulfilled The function to handle `then` for a `Promise`
     * @param {Function} rejected The function to handle `reject` for a `Promise`
     *
     * @return {Number} An ID used to remove interceptor later
     */
    InterceptorManager.prototype.use = function use(fulfilled, rejected, options) {
      this.handlers.push({
        fulfilled: fulfilled,
        rejected: rejected,
        synchronous: options ? options.synchronous : false,
        runWhen: options ? options.runWhen : null
      });
      return this.handlers.length - 1;
    };

    /**
     * Remove an interceptor from the stack
     *
     * @param {Number} id The ID that was returned by `use`
     */
    InterceptorManager.prototype.eject = function eject(id) {
      if (this.handlers[id]) {
        this.handlers[id] = null;
      }
    };

    /**
     * Iterate over all the registered interceptors
     *
     * This method is particularly useful for skipping over any
     * interceptors that may have become `null` calling `eject`.
     *
     * @param {Function} fn The function to call for each interceptor
     */
    InterceptorManager.prototype.forEach = function forEach(fn) {
      utils.forEach(this.handlers, function forEachHandler(h) {
        if (h !== null) {
          fn(h);
        }
      });
    };

    var InterceptorManager_1 = InterceptorManager;

    var normalizeHeaderName = function normalizeHeaderName(headers, normalizedName) {
      utils.forEach(headers, function processHeader(value, name) {
        if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
          headers[normalizedName] = value;
          delete headers[name];
        }
      });
    };

    /**
     * Create an Error with the specified message, config, error code, request and response.
     *
     * @param {string} message The error message.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [config] The config.
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     * @returns {Error} The created error.
     */
    function AxiosError(message, code, config, request, response) {
      Error.call(this);
      this.message = message;
      this.name = 'AxiosError';
      code && (this.code = code);
      config && (this.config = config);
      request && (this.request = request);
      response && (this.response = response);
    }

    utils.inherits(AxiosError, Error, {
      toJSON: function toJSON() {
        return {
          // Standard
          message: this.message,
          name: this.name,
          // Microsoft
          description: this.description,
          number: this.number,
          // Mozilla
          fileName: this.fileName,
          lineNumber: this.lineNumber,
          columnNumber: this.columnNumber,
          stack: this.stack,
          // Axios
          config: this.config,
          code: this.code,
          status: this.response && this.response.status ? this.response.status : null
        };
      }
    });

    var prototype = AxiosError.prototype;
    var descriptors = {};

    [
      'ERR_BAD_OPTION_VALUE',
      'ERR_BAD_OPTION',
      'ECONNABORTED',
      'ETIMEDOUT',
      'ERR_NETWORK',
      'ERR_FR_TOO_MANY_REDIRECTS',
      'ERR_DEPRECATED',
      'ERR_BAD_RESPONSE',
      'ERR_BAD_REQUEST',
      'ERR_CANCELED'
    // eslint-disable-next-line func-names
    ].forEach(function(code) {
      descriptors[code] = {value: code};
    });

    Object.defineProperties(AxiosError, descriptors);
    Object.defineProperty(prototype, 'isAxiosError', {value: true});

    // eslint-disable-next-line func-names
    AxiosError.from = function(error, code, config, request, response, customProps) {
      var axiosError = Object.create(prototype);

      utils.toFlatObject(error, axiosError, function filter(obj) {
        return obj !== Error.prototype;
      });

      AxiosError.call(axiosError, error.message, code, config, request, response);

      axiosError.name = error.name;

      customProps && Object.assign(axiosError, customProps);

      return axiosError;
    };

    var AxiosError_1 = AxiosError;

    var transitional = {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    };

    /**
     * Convert a data object to FormData
     * @param {Object} obj
     * @param {?Object} [formData]
     * @returns {Object}
     **/

    function toFormData(obj, formData) {
      // eslint-disable-next-line no-param-reassign
      formData = formData || new FormData();

      var stack = [];

      function convertValue(value) {
        if (value === null) return '';

        if (utils.isDate(value)) {
          return value.toISOString();
        }

        if (utils.isArrayBuffer(value) || utils.isTypedArray(value)) {
          return typeof Blob === 'function' ? new Blob([value]) : Buffer.from(value);
        }

        return value;
      }

      function build(data, parentKey) {
        if (utils.isPlainObject(data) || utils.isArray(data)) {
          if (stack.indexOf(data) !== -1) {
            throw Error('Circular reference detected in ' + parentKey);
          }

          stack.push(data);

          utils.forEach(data, function each(value, key) {
            if (utils.isUndefined(value)) return;
            var fullKey = parentKey ? parentKey + '.' + key : key;
            var arr;

            if (value && !parentKey && typeof value === 'object') {
              if (utils.endsWith(key, '{}')) {
                // eslint-disable-next-line no-param-reassign
                value = JSON.stringify(value);
              } else if (utils.endsWith(key, '[]') && (arr = utils.toArray(value))) {
                // eslint-disable-next-line func-names
                arr.forEach(function(el) {
                  !utils.isUndefined(el) && formData.append(fullKey, convertValue(el));
                });
                return;
              }
            }

            build(value, fullKey);
          });

          stack.pop();
        } else {
          formData.append(parentKey, convertValue(data));
        }
      }

      build(obj);

      return formData;
    }

    var toFormData_1 = toFormData;

    /**
     * Resolve or reject a Promise based on response status.
     *
     * @param {Function} resolve A function that resolves the promise.
     * @param {Function} reject A function that rejects the promise.
     * @param {object} response The response.
     */
    var settle = function settle(resolve, reject, response) {
      var validateStatus = response.config.validateStatus;
      if (!response.status || !validateStatus || validateStatus(response.status)) {
        resolve(response);
      } else {
        reject(new AxiosError_1(
          'Request failed with status code ' + response.status,
          [AxiosError_1.ERR_BAD_REQUEST, AxiosError_1.ERR_BAD_RESPONSE][Math.floor(response.status / 100) - 4],
          response.config,
          response.request,
          response
        ));
      }
    };

    var cookies = (
      utils.isStandardBrowserEnv() ?

      // Standard browser envs support document.cookie
        (function standardBrowserEnv() {
          return {
            write: function write(name, value, expires, path, domain, secure) {
              var cookie = [];
              cookie.push(name + '=' + encodeURIComponent(value));

              if (utils.isNumber(expires)) {
                cookie.push('expires=' + new Date(expires).toGMTString());
              }

              if (utils.isString(path)) {
                cookie.push('path=' + path);
              }

              if (utils.isString(domain)) {
                cookie.push('domain=' + domain);
              }

              if (secure === true) {
                cookie.push('secure');
              }

              document.cookie = cookie.join('; ');
            },

            read: function read(name) {
              var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
              return (match ? decodeURIComponent(match[3]) : null);
            },

            remove: function remove(name) {
              this.write(name, '', Date.now() - 86400000);
            }
          };
        })() :

      // Non standard browser env (web workers, react-native) lack needed support.
        (function nonStandardBrowserEnv() {
          return {
            write: function write() {},
            read: function read() { return null; },
            remove: function remove() {}
          };
        })()
    );

    /**
     * Determines whether the specified URL is absolute
     *
     * @param {string} url The URL to test
     * @returns {boolean} True if the specified URL is absolute, otherwise false
     */
    var isAbsoluteURL = function isAbsoluteURL(url) {
      // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
      // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
      // by any combination of letters, digits, plus, period, or hyphen.
      return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
    };

    /**
     * Creates a new URL by combining the specified URLs
     *
     * @param {string} baseURL The base URL
     * @param {string} relativeURL The relative URL
     * @returns {string} The combined URL
     */
    var combineURLs = function combineURLs(baseURL, relativeURL) {
      return relativeURL
        ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
        : baseURL;
    };

    /**
     * Creates a new URL by combining the baseURL with the requestedURL,
     * only when the requestedURL is not already an absolute URL.
     * If the requestURL is absolute, this function returns the requestedURL untouched.
     *
     * @param {string} baseURL The base URL
     * @param {string} requestedURL Absolute or relative URL to combine
     * @returns {string} The combined full path
     */
    var buildFullPath = function buildFullPath(baseURL, requestedURL) {
      if (baseURL && !isAbsoluteURL(requestedURL)) {
        return combineURLs(baseURL, requestedURL);
      }
      return requestedURL;
    };

    // Headers whose duplicates are ignored by node
    // c.f. https://nodejs.org/api/http.html#http_message_headers
    var ignoreDuplicateOf = [
      'age', 'authorization', 'content-length', 'content-type', 'etag',
      'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
      'last-modified', 'location', 'max-forwards', 'proxy-authorization',
      'referer', 'retry-after', 'user-agent'
    ];

    /**
     * Parse headers into an object
     *
     * ```
     * Date: Wed, 27 Aug 2014 08:58:49 GMT
     * Content-Type: application/json
     * Connection: keep-alive
     * Transfer-Encoding: chunked
     * ```
     *
     * @param {String} headers Headers needing to be parsed
     * @returns {Object} Headers parsed into an object
     */
    var parseHeaders = function parseHeaders(headers) {
      var parsed = {};
      var key;
      var val;
      var i;

      if (!headers) { return parsed; }

      utils.forEach(headers.split('\n'), function parser(line) {
        i = line.indexOf(':');
        key = utils.trim(line.substr(0, i)).toLowerCase();
        val = utils.trim(line.substr(i + 1));

        if (key) {
          if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
            return;
          }
          if (key === 'set-cookie') {
            parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
          } else {
            parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
          }
        }
      });

      return parsed;
    };

    var isURLSameOrigin = (
      utils.isStandardBrowserEnv() ?

      // Standard browser envs have full support of the APIs needed to test
      // whether the request URL is of the same origin as current location.
        (function standardBrowserEnv() {
          var msie = /(msie|trident)/i.test(navigator.userAgent);
          var urlParsingNode = document.createElement('a');
          var originURL;

          /**
        * Parse a URL to discover it's components
        *
        * @param {String} url The URL to be parsed
        * @returns {Object}
        */
          function resolveURL(url) {
            var href = url;

            if (msie) {
            // IE needs attribute set twice to normalize properties
              urlParsingNode.setAttribute('href', href);
              href = urlParsingNode.href;
            }

            urlParsingNode.setAttribute('href', href);

            // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
            return {
              href: urlParsingNode.href,
              protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
              host: urlParsingNode.host,
              search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
              hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
              hostname: urlParsingNode.hostname,
              port: urlParsingNode.port,
              pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
                urlParsingNode.pathname :
                '/' + urlParsingNode.pathname
            };
          }

          originURL = resolveURL(window.location.href);

          /**
        * Determine if a URL shares the same origin as the current location
        *
        * @param {String} requestURL The URL to test
        * @returns {boolean} True if URL shares the same origin, otherwise false
        */
          return function isURLSameOrigin(requestURL) {
            var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
            return (parsed.protocol === originURL.protocol &&
                parsed.host === originURL.host);
          };
        })() :

      // Non standard browser envs (web workers, react-native) lack needed support.
        (function nonStandardBrowserEnv() {
          return function isURLSameOrigin() {
            return true;
          };
        })()
    );

    /**
     * A `CanceledError` is an object that is thrown when an operation is canceled.
     *
     * @class
     * @param {string=} message The message.
     */
    function CanceledError(message) {
      // eslint-disable-next-line no-eq-null,eqeqeq
      AxiosError_1.call(this, message == null ? 'canceled' : message, AxiosError_1.ERR_CANCELED);
      this.name = 'CanceledError';
    }

    utils.inherits(CanceledError, AxiosError_1, {
      __CANCEL__: true
    });

    var CanceledError_1 = CanceledError;

    var parseProtocol = function parseProtocol(url) {
      var match = /^([-+\w]{1,25})(:?\/\/|:)/.exec(url);
      return match && match[1] || '';
    };

    var xhr = function xhrAdapter(config) {
      return new Promise(function dispatchXhrRequest(resolve, reject) {
        var requestData = config.data;
        var requestHeaders = config.headers;
        var responseType = config.responseType;
        var onCanceled;
        function done() {
          if (config.cancelToken) {
            config.cancelToken.unsubscribe(onCanceled);
          }

          if (config.signal) {
            config.signal.removeEventListener('abort', onCanceled);
          }
        }

        if (utils.isFormData(requestData) && utils.isStandardBrowserEnv()) {
          delete requestHeaders['Content-Type']; // Let the browser set it
        }

        var request = new XMLHttpRequest();

        // HTTP basic authentication
        if (config.auth) {
          var username = config.auth.username || '';
          var password = config.auth.password ? unescape(encodeURIComponent(config.auth.password)) : '';
          requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
        }

        var fullPath = buildFullPath(config.baseURL, config.url);

        request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);

        // Set the request timeout in MS
        request.timeout = config.timeout;

        function onloadend() {
          if (!request) {
            return;
          }
          // Prepare the response
          var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
          var responseData = !responseType || responseType === 'text' ||  responseType === 'json' ?
            request.responseText : request.response;
          var response = {
            data: responseData,
            status: request.status,
            statusText: request.statusText,
            headers: responseHeaders,
            config: config,
            request: request
          };

          settle(function _resolve(value) {
            resolve(value);
            done();
          }, function _reject(err) {
            reject(err);
            done();
          }, response);

          // Clean up request
          request = null;
        }

        if ('onloadend' in request) {
          // Use onloadend if available
          request.onloadend = onloadend;
        } else {
          // Listen for ready state to emulate onloadend
          request.onreadystatechange = function handleLoad() {
            if (!request || request.readyState !== 4) {
              return;
            }

            // The request errored out and we didn't get a response, this will be
            // handled by onerror instead
            // With one exception: request that using file: protocol, most browsers
            // will return status as 0 even though it's a successful request
            if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
              return;
            }
            // readystate handler is calling before onerror or ontimeout handlers,
            // so we should call onloadend on the next 'tick'
            setTimeout(onloadend);
          };
        }

        // Handle browser request cancellation (as opposed to a manual cancellation)
        request.onabort = function handleAbort() {
          if (!request) {
            return;
          }

          reject(new AxiosError_1('Request aborted', AxiosError_1.ECONNABORTED, config, request));

          // Clean up request
          request = null;
        };

        // Handle low level network errors
        request.onerror = function handleError() {
          // Real errors are hidden from us by the browser
          // onerror should only fire if it's a network error
          reject(new AxiosError_1('Network Error', AxiosError_1.ERR_NETWORK, config, request, request));

          // Clean up request
          request = null;
        };

        // Handle timeout
        request.ontimeout = function handleTimeout() {
          var timeoutErrorMessage = config.timeout ? 'timeout of ' + config.timeout + 'ms exceeded' : 'timeout exceeded';
          var transitional$1 = config.transitional || transitional;
          if (config.timeoutErrorMessage) {
            timeoutErrorMessage = config.timeoutErrorMessage;
          }
          reject(new AxiosError_1(
            timeoutErrorMessage,
            transitional$1.clarifyTimeoutError ? AxiosError_1.ETIMEDOUT : AxiosError_1.ECONNABORTED,
            config,
            request));

          // Clean up request
          request = null;
        };

        // Add xsrf header
        // This is only done if running in a standard browser environment.
        // Specifically not if we're in a web worker, or react-native.
        if (utils.isStandardBrowserEnv()) {
          // Add xsrf header
          var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
            cookies.read(config.xsrfCookieName) :
            undefined;

          if (xsrfValue) {
            requestHeaders[config.xsrfHeaderName] = xsrfValue;
          }
        }

        // Add headers to the request
        if ('setRequestHeader' in request) {
          utils.forEach(requestHeaders, function setRequestHeader(val, key) {
            if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
              // Remove Content-Type if data is undefined
              delete requestHeaders[key];
            } else {
              // Otherwise add header to the request
              request.setRequestHeader(key, val);
            }
          });
        }

        // Add withCredentials to request if needed
        if (!utils.isUndefined(config.withCredentials)) {
          request.withCredentials = !!config.withCredentials;
        }

        // Add responseType to request if needed
        if (responseType && responseType !== 'json') {
          request.responseType = config.responseType;
        }

        // Handle progress if needed
        if (typeof config.onDownloadProgress === 'function') {
          request.addEventListener('progress', config.onDownloadProgress);
        }

        // Not all browsers support upload events
        if (typeof config.onUploadProgress === 'function' && request.upload) {
          request.upload.addEventListener('progress', config.onUploadProgress);
        }

        if (config.cancelToken || config.signal) {
          // Handle cancellation
          // eslint-disable-next-line func-names
          onCanceled = function(cancel) {
            if (!request) {
              return;
            }
            reject(!cancel || (cancel && cancel.type) ? new CanceledError_1() : cancel);
            request.abort();
            request = null;
          };

          config.cancelToken && config.cancelToken.subscribe(onCanceled);
          if (config.signal) {
            config.signal.aborted ? onCanceled() : config.signal.addEventListener('abort', onCanceled);
          }
        }

        if (!requestData) {
          requestData = null;
        }

        var protocol = parseProtocol(fullPath);

        if (protocol && [ 'http', 'https', 'file' ].indexOf(protocol) === -1) {
          reject(new AxiosError_1('Unsupported protocol ' + protocol + ':', AxiosError_1.ERR_BAD_REQUEST, config));
          return;
        }


        // Send the request
        request.send(requestData);
      });
    };

    // eslint-disable-next-line strict
    var _null = null;

    var DEFAULT_CONTENT_TYPE = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    function setContentTypeIfUnset(headers, value) {
      if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
        headers['Content-Type'] = value;
      }
    }

    function getDefaultAdapter() {
      var adapter;
      if (typeof XMLHttpRequest !== 'undefined') {
        // For browsers use XHR adapter
        adapter = xhr;
      } else if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
        // For node use HTTP adapter
        adapter = xhr;
      }
      return adapter;
    }

    function stringifySafely(rawValue, parser, encoder) {
      if (utils.isString(rawValue)) {
        try {
          (parser || JSON.parse)(rawValue);
          return utils.trim(rawValue);
        } catch (e) {
          if (e.name !== 'SyntaxError') {
            throw e;
          }
        }
      }

      return (encoder || JSON.stringify)(rawValue);
    }

    var defaults = {

      transitional: transitional,

      adapter: getDefaultAdapter(),

      transformRequest: [function transformRequest(data, headers) {
        normalizeHeaderName(headers, 'Accept');
        normalizeHeaderName(headers, 'Content-Type');

        if (utils.isFormData(data) ||
          utils.isArrayBuffer(data) ||
          utils.isBuffer(data) ||
          utils.isStream(data) ||
          utils.isFile(data) ||
          utils.isBlob(data)
        ) {
          return data;
        }
        if (utils.isArrayBufferView(data)) {
          return data.buffer;
        }
        if (utils.isURLSearchParams(data)) {
          setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
          return data.toString();
        }

        var isObjectPayload = utils.isObject(data);
        var contentType = headers && headers['Content-Type'];

        var isFileList;

        if ((isFileList = utils.isFileList(data)) || (isObjectPayload && contentType === 'multipart/form-data')) {
          var _FormData = this.env && this.env.FormData;
          return toFormData_1(isFileList ? {'files[]': data} : data, _FormData && new _FormData());
        } else if (isObjectPayload || contentType === 'application/json') {
          setContentTypeIfUnset(headers, 'application/json');
          return stringifySafely(data);
        }

        return data;
      }],

      transformResponse: [function transformResponse(data) {
        var transitional = this.transitional || defaults.transitional;
        var silentJSONParsing = transitional && transitional.silentJSONParsing;
        var forcedJSONParsing = transitional && transitional.forcedJSONParsing;
        var strictJSONParsing = !silentJSONParsing && this.responseType === 'json';

        if (strictJSONParsing || (forcedJSONParsing && utils.isString(data) && data.length)) {
          try {
            return JSON.parse(data);
          } catch (e) {
            if (strictJSONParsing) {
              if (e.name === 'SyntaxError') {
                throw AxiosError_1.from(e, AxiosError_1.ERR_BAD_RESPONSE, this, null, this.response);
              }
              throw e;
            }
          }
        }

        return data;
      }],

      /**
       * A timeout in milliseconds to abort a request. If set to 0 (default) a
       * timeout is not created.
       */
      timeout: 0,

      xsrfCookieName: 'XSRF-TOKEN',
      xsrfHeaderName: 'X-XSRF-TOKEN',

      maxContentLength: -1,
      maxBodyLength: -1,

      env: {
        FormData: _null
      },

      validateStatus: function validateStatus(status) {
        return status >= 200 && status < 300;
      },

      headers: {
        common: {
          'Accept': 'application/json, text/plain, */*'
        }
      }
    };

    utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
      defaults.headers[method] = {};
    });

    utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
    });

    var defaults_1 = defaults;

    /**
     * Transform the data for a request or a response
     *
     * @param {Object|String} data The data to be transformed
     * @param {Array} headers The headers for the request or response
     * @param {Array|Function} fns A single function or Array of functions
     * @returns {*} The resulting transformed data
     */
    var transformData = function transformData(data, headers, fns) {
      var context = this || defaults_1;
      /*eslint no-param-reassign:0*/
      utils.forEach(fns, function transform(fn) {
        data = fn.call(context, data, headers);
      });

      return data;
    };

    var isCancel = function isCancel(value) {
      return !!(value && value.__CANCEL__);
    };

    /**
     * Throws a `CanceledError` if cancellation has been requested.
     */
    function throwIfCancellationRequested(config) {
      if (config.cancelToken) {
        config.cancelToken.throwIfRequested();
      }

      if (config.signal && config.signal.aborted) {
        throw new CanceledError_1();
      }
    }

    /**
     * Dispatch a request to the server using the configured adapter.
     *
     * @param {object} config The config that is to be used for the request
     * @returns {Promise} The Promise to be fulfilled
     */
    var dispatchRequest = function dispatchRequest(config) {
      throwIfCancellationRequested(config);

      // Ensure headers exist
      config.headers = config.headers || {};

      // Transform request data
      config.data = transformData.call(
        config,
        config.data,
        config.headers,
        config.transformRequest
      );

      // Flatten headers
      config.headers = utils.merge(
        config.headers.common || {},
        config.headers[config.method] || {},
        config.headers
      );

      utils.forEach(
        ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
        function cleanHeaderConfig(method) {
          delete config.headers[method];
        }
      );

      var adapter = config.adapter || defaults_1.adapter;

      return adapter(config).then(function onAdapterResolution(response) {
        throwIfCancellationRequested(config);

        // Transform response data
        response.data = transformData.call(
          config,
          response.data,
          response.headers,
          config.transformResponse
        );

        return response;
      }, function onAdapterRejection(reason) {
        if (!isCancel(reason)) {
          throwIfCancellationRequested(config);

          // Transform response data
          if (reason && reason.response) {
            reason.response.data = transformData.call(
              config,
              reason.response.data,
              reason.response.headers,
              config.transformResponse
            );
          }
        }

        return Promise.reject(reason);
      });
    };

    /**
     * Config-specific merge-function which creates a new config-object
     * by merging two configuration objects together.
     *
     * @param {Object} config1
     * @param {Object} config2
     * @returns {Object} New object resulting from merging config2 to config1
     */
    var mergeConfig = function mergeConfig(config1, config2) {
      // eslint-disable-next-line no-param-reassign
      config2 = config2 || {};
      var config = {};

      function getMergedValue(target, source) {
        if (utils.isPlainObject(target) && utils.isPlainObject(source)) {
          return utils.merge(target, source);
        } else if (utils.isPlainObject(source)) {
          return utils.merge({}, source);
        } else if (utils.isArray(source)) {
          return source.slice();
        }
        return source;
      }

      // eslint-disable-next-line consistent-return
      function mergeDeepProperties(prop) {
        if (!utils.isUndefined(config2[prop])) {
          return getMergedValue(config1[prop], config2[prop]);
        } else if (!utils.isUndefined(config1[prop])) {
          return getMergedValue(undefined, config1[prop]);
        }
      }

      // eslint-disable-next-line consistent-return
      function valueFromConfig2(prop) {
        if (!utils.isUndefined(config2[prop])) {
          return getMergedValue(undefined, config2[prop]);
        }
      }

      // eslint-disable-next-line consistent-return
      function defaultToConfig2(prop) {
        if (!utils.isUndefined(config2[prop])) {
          return getMergedValue(undefined, config2[prop]);
        } else if (!utils.isUndefined(config1[prop])) {
          return getMergedValue(undefined, config1[prop]);
        }
      }

      // eslint-disable-next-line consistent-return
      function mergeDirectKeys(prop) {
        if (prop in config2) {
          return getMergedValue(config1[prop], config2[prop]);
        } else if (prop in config1) {
          return getMergedValue(undefined, config1[prop]);
        }
      }

      var mergeMap = {
        'url': valueFromConfig2,
        'method': valueFromConfig2,
        'data': valueFromConfig2,
        'baseURL': defaultToConfig2,
        'transformRequest': defaultToConfig2,
        'transformResponse': defaultToConfig2,
        'paramsSerializer': defaultToConfig2,
        'timeout': defaultToConfig2,
        'timeoutMessage': defaultToConfig2,
        'withCredentials': defaultToConfig2,
        'adapter': defaultToConfig2,
        'responseType': defaultToConfig2,
        'xsrfCookieName': defaultToConfig2,
        'xsrfHeaderName': defaultToConfig2,
        'onUploadProgress': defaultToConfig2,
        'onDownloadProgress': defaultToConfig2,
        'decompress': defaultToConfig2,
        'maxContentLength': defaultToConfig2,
        'maxBodyLength': defaultToConfig2,
        'beforeRedirect': defaultToConfig2,
        'transport': defaultToConfig2,
        'httpAgent': defaultToConfig2,
        'httpsAgent': defaultToConfig2,
        'cancelToken': defaultToConfig2,
        'socketPath': defaultToConfig2,
        'responseEncoding': defaultToConfig2,
        'validateStatus': mergeDirectKeys
      };

      utils.forEach(Object.keys(config1).concat(Object.keys(config2)), function computeConfigValue(prop) {
        var merge = mergeMap[prop] || mergeDeepProperties;
        var configValue = merge(prop);
        (utils.isUndefined(configValue) && merge !== mergeDirectKeys) || (config[prop] = configValue);
      });

      return config;
    };

    var data = {
      "version": "0.27.2"
    };

    var VERSION = data.version;


    var validators$1 = {};

    // eslint-disable-next-line func-names
    ['object', 'boolean', 'number', 'function', 'string', 'symbol'].forEach(function(type, i) {
      validators$1[type] = function validator(thing) {
        return typeof thing === type || 'a' + (i < 1 ? 'n ' : ' ') + type;
      };
    });

    var deprecatedWarnings = {};

    /**
     * Transitional option validator
     * @param {function|boolean?} validator - set to false if the transitional option has been removed
     * @param {string?} version - deprecated version / removed since version
     * @param {string?} message - some message with additional info
     * @returns {function}
     */
    validators$1.transitional = function transitional(validator, version, message) {
      function formatMessage(opt, desc) {
        return '[Axios v' + VERSION + '] Transitional option \'' + opt + '\'' + desc + (message ? '. ' + message : '');
      }

      // eslint-disable-next-line func-names
      return function(value, opt, opts) {
        if (validator === false) {
          throw new AxiosError_1(
            formatMessage(opt, ' has been removed' + (version ? ' in ' + version : '')),
            AxiosError_1.ERR_DEPRECATED
          );
        }

        if (version && !deprecatedWarnings[opt]) {
          deprecatedWarnings[opt] = true;
          // eslint-disable-next-line no-console
          console.warn(
            formatMessage(
              opt,
              ' has been deprecated since v' + version + ' and will be removed in the near future'
            )
          );
        }

        return validator ? validator(value, opt, opts) : true;
      };
    };

    /**
     * Assert object's properties type
     * @param {object} options
     * @param {object} schema
     * @param {boolean?} allowUnknown
     */

    function assertOptions(options, schema, allowUnknown) {
      if (typeof options !== 'object') {
        throw new AxiosError_1('options must be an object', AxiosError_1.ERR_BAD_OPTION_VALUE);
      }
      var keys = Object.keys(options);
      var i = keys.length;
      while (i-- > 0) {
        var opt = keys[i];
        var validator = schema[opt];
        if (validator) {
          var value = options[opt];
          var result = value === undefined || validator(value, opt, options);
          if (result !== true) {
            throw new AxiosError_1('option ' + opt + ' must be ' + result, AxiosError_1.ERR_BAD_OPTION_VALUE);
          }
          continue;
        }
        if (allowUnknown !== true) {
          throw new AxiosError_1('Unknown option ' + opt, AxiosError_1.ERR_BAD_OPTION);
        }
      }
    }

    var validator = {
      assertOptions: assertOptions,
      validators: validators$1
    };

    var validators = validator.validators;
    /**
     * Create a new instance of Axios
     *
     * @param {Object} instanceConfig The default config for the instance
     */
    function Axios(instanceConfig) {
      this.defaults = instanceConfig;
      this.interceptors = {
        request: new InterceptorManager_1(),
        response: new InterceptorManager_1()
      };
    }

    /**
     * Dispatch a request
     *
     * @param {Object} config The config specific for this request (merged with this.defaults)
     */
    Axios.prototype.request = function request(configOrUrl, config) {
      /*eslint no-param-reassign:0*/
      // Allow for axios('example/url'[, config]) a la fetch API
      if (typeof configOrUrl === 'string') {
        config = config || {};
        config.url = configOrUrl;
      } else {
        config = configOrUrl || {};
      }

      config = mergeConfig(this.defaults, config);

      // Set config.method
      if (config.method) {
        config.method = config.method.toLowerCase();
      } else if (this.defaults.method) {
        config.method = this.defaults.method.toLowerCase();
      } else {
        config.method = 'get';
      }

      var transitional = config.transitional;

      if (transitional !== undefined) {
        validator.assertOptions(transitional, {
          silentJSONParsing: validators.transitional(validators.boolean),
          forcedJSONParsing: validators.transitional(validators.boolean),
          clarifyTimeoutError: validators.transitional(validators.boolean)
        }, false);
      }

      // filter out skipped interceptors
      var requestInterceptorChain = [];
      var synchronousRequestInterceptors = true;
      this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
        if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
          return;
        }

        synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;

        requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
      });

      var responseInterceptorChain = [];
      this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
        responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
      });

      var promise;

      if (!synchronousRequestInterceptors) {
        var chain = [dispatchRequest, undefined];

        Array.prototype.unshift.apply(chain, requestInterceptorChain);
        chain = chain.concat(responseInterceptorChain);

        promise = Promise.resolve(config);
        while (chain.length) {
          promise = promise.then(chain.shift(), chain.shift());
        }

        return promise;
      }


      var newConfig = config;
      while (requestInterceptorChain.length) {
        var onFulfilled = requestInterceptorChain.shift();
        var onRejected = requestInterceptorChain.shift();
        try {
          newConfig = onFulfilled(newConfig);
        } catch (error) {
          onRejected(error);
          break;
        }
      }

      try {
        promise = dispatchRequest(newConfig);
      } catch (error) {
        return Promise.reject(error);
      }

      while (responseInterceptorChain.length) {
        promise = promise.then(responseInterceptorChain.shift(), responseInterceptorChain.shift());
      }

      return promise;
    };

    Axios.prototype.getUri = function getUri(config) {
      config = mergeConfig(this.defaults, config);
      var fullPath = buildFullPath(config.baseURL, config.url);
      return buildURL(fullPath, config.params, config.paramsSerializer);
    };

    // Provide aliases for supported request methods
    utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
      /*eslint func-names:0*/
      Axios.prototype[method] = function(url, config) {
        return this.request(mergeConfig(config || {}, {
          method: method,
          url: url,
          data: (config || {}).data
        }));
      };
    });

    utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      /*eslint func-names:0*/

      function generateHTTPMethod(isForm) {
        return function httpMethod(url, data, config) {
          return this.request(mergeConfig(config || {}, {
            method: method,
            headers: isForm ? {
              'Content-Type': 'multipart/form-data'
            } : {},
            url: url,
            data: data
          }));
        };
      }

      Axios.prototype[method] = generateHTTPMethod();

      Axios.prototype[method + 'Form'] = generateHTTPMethod(true);
    });

    var Axios_1 = Axios;

    /**
     * A `CancelToken` is an object that can be used to request cancellation of an operation.
     *
     * @class
     * @param {Function} executor The executor function.
     */
    function CancelToken(executor) {
      if (typeof executor !== 'function') {
        throw new TypeError('executor must be a function.');
      }

      var resolvePromise;

      this.promise = new Promise(function promiseExecutor(resolve) {
        resolvePromise = resolve;
      });

      var token = this;

      // eslint-disable-next-line func-names
      this.promise.then(function(cancel) {
        if (!token._listeners) return;

        var i;
        var l = token._listeners.length;

        for (i = 0; i < l; i++) {
          token._listeners[i](cancel);
        }
        token._listeners = null;
      });

      // eslint-disable-next-line func-names
      this.promise.then = function(onfulfilled) {
        var _resolve;
        // eslint-disable-next-line func-names
        var promise = new Promise(function(resolve) {
          token.subscribe(resolve);
          _resolve = resolve;
        }).then(onfulfilled);

        promise.cancel = function reject() {
          token.unsubscribe(_resolve);
        };

        return promise;
      };

      executor(function cancel(message) {
        if (token.reason) {
          // Cancellation has already been requested
          return;
        }

        token.reason = new CanceledError_1(message);
        resolvePromise(token.reason);
      });
    }

    /**
     * Throws a `CanceledError` if cancellation has been requested.
     */
    CancelToken.prototype.throwIfRequested = function throwIfRequested() {
      if (this.reason) {
        throw this.reason;
      }
    };

    /**
     * Subscribe to the cancel signal
     */

    CancelToken.prototype.subscribe = function subscribe(listener) {
      if (this.reason) {
        listener(this.reason);
        return;
      }

      if (this._listeners) {
        this._listeners.push(listener);
      } else {
        this._listeners = [listener];
      }
    };

    /**
     * Unsubscribe from the cancel signal
     */

    CancelToken.prototype.unsubscribe = function unsubscribe(listener) {
      if (!this._listeners) {
        return;
      }
      var index = this._listeners.indexOf(listener);
      if (index !== -1) {
        this._listeners.splice(index, 1);
      }
    };

    /**
     * Returns an object that contains a new `CancelToken` and a function that, when called,
     * cancels the `CancelToken`.
     */
    CancelToken.source = function source() {
      var cancel;
      var token = new CancelToken(function executor(c) {
        cancel = c;
      });
      return {
        token: token,
        cancel: cancel
      };
    };

    var CancelToken_1 = CancelToken;

    /**
     * Syntactic sugar for invoking a function and expanding an array for arguments.
     *
     * Common use case would be to use `Function.prototype.apply`.
     *
     *  ```js
     *  function f(x, y, z) {}
     *  var args = [1, 2, 3];
     *  f.apply(null, args);
     *  ```
     *
     * With `spread` this example can be re-written.
     *
     *  ```js
     *  spread(function(x, y, z) {})([1, 2, 3]);
     *  ```
     *
     * @param {Function} callback
     * @returns {Function}
     */
    var spread = function spread(callback) {
      return function wrap(arr) {
        return callback.apply(null, arr);
      };
    };

    /**
     * Determines whether the payload is an error thrown by Axios
     *
     * @param {*} payload The value to test
     * @returns {boolean} True if the payload is an error thrown by Axios, otherwise false
     */
    var isAxiosError = function isAxiosError(payload) {
      return utils.isObject(payload) && (payload.isAxiosError === true);
    };

    /**
     * Create an instance of Axios
     *
     * @param {Object} defaultConfig The default config for the instance
     * @return {Axios} A new instance of Axios
     */
    function createInstance(defaultConfig) {
      var context = new Axios_1(defaultConfig);
      var instance = bind(Axios_1.prototype.request, context);

      // Copy axios.prototype to instance
      utils.extend(instance, Axios_1.prototype, context);

      // Copy context to instance
      utils.extend(instance, context);

      // Factory for creating new instances
      instance.create = function create(instanceConfig) {
        return createInstance(mergeConfig(defaultConfig, instanceConfig));
      };

      return instance;
    }

    // Create the default instance to be exported
    var axios$1 = createInstance(defaults_1);

    // Expose Axios class to allow class inheritance
    axios$1.Axios = Axios_1;

    // Expose Cancel & CancelToken
    axios$1.CanceledError = CanceledError_1;
    axios$1.CancelToken = CancelToken_1;
    axios$1.isCancel = isCancel;
    axios$1.VERSION = data.version;
    axios$1.toFormData = toFormData_1;

    // Expose AxiosError class
    axios$1.AxiosError = AxiosError_1;

    // alias for CanceledError for backward compatibility
    axios$1.Cancel = axios$1.CanceledError;

    // Expose all/spread
    axios$1.all = function all(promises) {
      return Promise.all(promises);
    };
    axios$1.spread = spread;

    // Expose isAxiosError
    axios$1.isAxiosError = isAxiosError;

    var axios_1 = axios$1;

    // Allow use of default import syntax in TypeScript
    var _default = axios$1;
    axios_1.default = _default;

    var axios = axios_1;

    /* src\components\Header\Logo.svelte generated by Svelte v3.49.0 */

    const file$6 = "src\\components\\Header\\Logo.svelte";

    function create_fragment$6(ctx) {
    	let div;
    	let h1;
    	let a;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			a = element("a");
    			a.textContent = "Quran";
    			attr_dev(a, "href", "index.html");
    			add_location(a, file$6, 3, 8, 54);
    			add_location(h1, file$6, 3, 4, 50);
    			attr_dev(div, "class", "site-logo");
    			add_location(div, file$6, 2, 0, 21);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(h1, a);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
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
    	validate_slots('Logo', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Logo> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Logo extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Logo",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src\components\Header\Search.svelte generated by Svelte v3.49.0 */

    const file$5 = "src\\components\\Header\\Search.svelte";

    function create_fragment$5(ctx) {
    	let div;
    	let form;
    	let button;
    	let svg;
    	let g;
    	let path;
    	let circle;
    	let t;
    	let input;

    	const block = {
    		c: function create() {
    			div = element("div");
    			form = element("form");
    			button = element("button");
    			svg = svg_element("svg");
    			g = svg_element("g");
    			path = svg_element("path");
    			circle = svg_element("circle");
    			t = space();
    			input = element("input");
    			attr_dev(path, "d", "m11.25 11.25l3 3");
    			add_location(path, file$5, 4, 304, 398);
    			attr_dev(circle, "cx", "7.5");
    			attr_dev(circle, "cy", "7.5");
    			attr_dev(circle, "r", "4.75");
    			add_location(circle, file$5, 4, 332, 426);
    			attr_dev(g, "fill", "none");
    			attr_dev(g, "stroke", "currentColor");
    			attr_dev(g, "stroke-linecap", "round");
    			attr_dev(g, "stroke-linejoin", "round");
    			attr_dev(g, "stroke-width", "1.5");
    			add_location(g, file$5, 4, 201, 295);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "aria-hidden", "true");
    			attr_dev(svg, "role", "img");
    			attr_dev(svg, "width", "1em");
    			attr_dev(svg, "height", "1em");
    			attr_dev(svg, "preserveAspectRatio", "xMidYMid meet");
    			attr_dev(svg, "viewBox", "0 0 16 16");
    			add_location(svg, file$5, 4, 50, 144);
    			attr_dev(button, "type", "button");
    			attr_dev(button, "class", "search__btn");
    			add_location(button, file$5, 4, 8, 102);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "name", "q");
    			attr_dev(input, "placeholder", "Search here for surah, ayah");
    			input.required = true;
    			add_location(input, file$5, 5, 8, 491);
    			attr_dev(form, "action", "");
    			attr_dev(form, "class", "search__form");
    			add_location(form, file$5, 3, 4, 55);
    			attr_dev(div, "class", "search-wrapper");
    			add_location(div, file$5, 2, 0, 21);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, form);
    			append_dev(form, button);
    			append_dev(button, svg);
    			append_dev(svg, g);
    			append_dev(g, path);
    			append_dev(g, circle);
    			append_dev(form, t);
    			append_dev(form, input);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
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

    function instance$5($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Search', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Search> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Search extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Search",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src\components\Header\Header.svelte generated by Svelte v3.49.0 */
    const file$4 = "src\\components\\Header\\Header.svelte";

    function create_fragment$4(ctx) {
    	let header;
    	let div;
    	let logo;
    	let t;
    	let search;
    	let current;
    	logo = new Logo({ $$inline: true });
    	search = new Search({ $$inline: true });

    	const block = {
    		c: function create() {
    			header = element("header");
    			div = element("div");
    			create_component(logo.$$.fragment);
    			t = space();
    			create_component(search.$$.fragment);
    			attr_dev(div, "class", "header__inner");
    			add_location(div, file$4, 6, 4, 139);
    			attr_dev(header, "class", "site-header");
    			add_location(header, file$4, 5, 0, 105);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, div);
    			mount_component(logo, div, null);
    			append_dev(div, t);
    			mount_component(search, div, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(logo.$$.fragment, local);
    			transition_in(search.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(logo.$$.fragment, local);
    			transition_out(search.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			destroy_component(logo);
    			destroy_component(search);
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
    	validate_slots('Header', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Logo, Search });
    	return [];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src\components\Main\Sidebar.svelte generated by Svelte v3.49.0 */
    const file$3 = "src\\components\\Main\\Sidebar.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (50:0) {#if showChapters }
    function create_if_block$1(ctx) {
    	let div1;
    	let div0;
    	let button;
    	let t1;
    	let each_value = /*chapters*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			button = element("button");
    			button.textContent = "Sort by";
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(button, "type", "button");
    			attr_dev(button, "class", "btn");
    			add_location(button, file$3, 53, 8, 1129);
    			attr_dev(div0, "class", "chapters__filter");
    			add_location(div0, file$3, 52, 4, 1089);
    			attr_dev(div1, "class", "chapters-list");
    			add_location(div1, file$3, 50, 0, 1054);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, button);
    			append_dev(div1, t1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*currentSurah, chapters, selectChapter*/ 11) {
    				each_value = /*chapters*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(50:0) {#if showChapters }",
    		ctx
    	});

    	return block;
    }

    // (57:4) {#each chapters as chapter, i }
    function create_each_block$1(ctx) {
    	let div1;
    	let span0;
    	let t0_value = /*chapter*/ ctx[6].chapter_number + "";
    	let t0;
    	let t1;
    	let div0;
    	let span1;
    	let t2_value = /*chapter*/ ctx[6].name_simple + "";
    	let t2;
    	let t3;
    	let span2;
    	let t4_value = /*chapter*/ ctx[6].translated_name.name + "";
    	let t4;
    	let t5;
    	let span3;
    	let t6_value = /*chapter*/ ctx[6].verses_count + "";
    	let t6;
    	let t7;
    	let t8;
    	let div1_class_value;
    	let div1_data_id_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			div0 = element("div");
    			span1 = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			span2 = element("span");
    			t4 = text(t4_value);
    			t5 = space();
    			span3 = element("span");
    			t6 = text(t6_value);
    			t7 = text(" Verses");
    			t8 = space();
    			attr_dev(span0, "class", "chapter__no");
    			add_location(span0, file$3, 58, 8, 1374);
    			attr_dev(span1, "class", "chapter__name");
    			add_location(span1, file$3, 60, 12, 1482);
    			attr_dev(span2, "class", "chapter__name-translate");
    			add_location(span2, file$3, 61, 12, 1552);
    			attr_dev(span3, "class", "chapter__verses badge");
    			add_location(span3, file$3, 62, 12, 1641);
    			attr_dev(div0, "class", "chapter__info");
    			add_location(div0, file$3, 59, 8, 1441);

    			attr_dev(div1, "class", div1_class_value = "chapter" + (/*currentSurah*/ ctx[1] === /*chapter*/ ctx[6].id
    			? ' active'
    			: ''));

    			attr_dev(div1, "data-id", div1_data_id_value = /*chapter*/ ctx[6].id);
    			add_location(div1, file$3, 57, 4, 1236);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, span0);
    			append_dev(span0, t0);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, span1);
    			append_dev(span1, t2);
    			append_dev(div0, t3);
    			append_dev(div0, span2);
    			append_dev(span2, t4);
    			append_dev(div0, t5);
    			append_dev(div0, span3);
    			append_dev(span3, t6);
    			append_dev(span3, t7);
    			append_dev(div1, t8);

    			if (!mounted) {
    				dispose = listen_dev(
    					div1,
    					"click",
    					function () {
    						if (is_function(/*selectChapter*/ ctx[3](/*chapter*/ ctx[6].id))) /*selectChapter*/ ctx[3](/*chapter*/ ctx[6].id).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*chapters*/ 1 && t0_value !== (t0_value = /*chapter*/ ctx[6].chapter_number + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*chapters*/ 1 && t2_value !== (t2_value = /*chapter*/ ctx[6].name_simple + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*chapters*/ 1 && t4_value !== (t4_value = /*chapter*/ ctx[6].translated_name.name + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*chapters*/ 1 && t6_value !== (t6_value = /*chapter*/ ctx[6].verses_count + "")) set_data_dev(t6, t6_value);

    			if (dirty & /*currentSurah, chapters*/ 3 && div1_class_value !== (div1_class_value = "chapter" + (/*currentSurah*/ ctx[1] === /*chapter*/ ctx[6].id
    			? ' active'
    			: ''))) {
    				attr_dev(div1, "class", div1_class_value);
    			}

    			if (dirty & /*chapters*/ 1 && div1_data_id_value !== (div1_data_id_value = /*chapter*/ ctx[6].id)) {
    				attr_dev(div1, "data-id", div1_data_id_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(57:4) {#each chapters as chapter, i }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let if_block_anchor;
    	let if_block = /*showChapters*/ ctx[2] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*showChapters*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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
    	validate_slots('Sidebar', slots, []);
    	var chapters = [];
    	var currentSurah = null;
    	var showChapters = true;

    	var showChaptersCB = () => {
    		if (window.outerWidth > 991) {
    			$$invalidate(2, showChapters = true);
    		} else {
    			if (currentSurah !== null) {
    				$$invalidate(2, showChapters = false);
    			} else {
    				$$invalidate(2, showChapters = true);
    			}
    		}
    	};

    	var unsubscribe = data$1.subscribe(object => {
    		$$invalidate(0, chapters = object.chapters);

    		if (object.currentSurah === null) {
    			return;
    		}

    		$$invalidate(1, currentSurah = object.currentSurah);
    		showChaptersCB();
    	});

    	showChaptersCB();

    	var selectChapter = id => {
    		data$1.update(object => {
    			object.currentSurah = id;
    			$$invalidate(2, showChapters = true);
    			return object;
    		});
    	};

    	onDestroy(() => {
    		unsubscribe();
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Sidebar> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onDestroy,
    		data: data$1,
    		chapters,
    		currentSurah,
    		showChapters,
    		showChaptersCB,
    		unsubscribe,
    		selectChapter
    	});

    	$$self.$inject_state = $$props => {
    		if ('chapters' in $$props) $$invalidate(0, chapters = $$props.chapters);
    		if ('currentSurah' in $$props) $$invalidate(1, currentSurah = $$props.currentSurah);
    		if ('showChapters' in $$props) $$invalidate(2, showChapters = $$props.showChapters);
    		if ('showChaptersCB' in $$props) showChaptersCB = $$props.showChaptersCB;
    		if ('unsubscribe' in $$props) unsubscribe = $$props.unsubscribe;
    		if ('selectChapter' in $$props) $$invalidate(3, selectChapter = $$props.selectChapter);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [chapters, currentSurah, showChapters, selectChapter];
    }

    class Sidebar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sidebar",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\components\Main\Loading.svelte generated by Svelte v3.49.0 */

    const file$2 = "src\\components\\Main\\Loading.svelte";

    function create_fragment$2(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			div0.textContent = "Loading...";
    			attr_dev(div0, "class", "state__title");
    			add_location(div0, file$2, 1, 4, 25);
    			attr_dev(div1, "class", "state");
    			add_location(div1, file$2, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
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

    function instance$2($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Loading', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Loading> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Loading extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Loading",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\components\Main\Surah.svelte generated by Svelte v3.49.0 */

    const { console: console_1$1 } = globals;
    const file$1 = "src\\components\\Main\\Surah.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	child_ctx[11] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i];
    	child_ctx[11] = i;
    	return child_ctx;
    }

    // (99:0) {#if showSurah }
    function create_if_block(ctx) {
    	let div1;
    	let t0;
    	let t1;
    	let t2;
    	let div0;
    	let div0_style_value;
    	let current;
    	let if_block0 = window.outerWidth < 992 && create_if_block_3(ctx);
    	let if_block1 = /*surahInfo*/ ctx[2] && create_if_block_2(ctx);
    	let if_block2 = /*loading*/ ctx[1] && create_if_block_1(ctx);
    	let each_value = /*surah*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			if (if_block2) if_block2.c();
    			t2 = space();
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div0, "class", "verses");
    			attr_dev(div0, "style", div0_style_value = /*loading*/ ctx[1] ? 'display:none' : '');
    			add_location(div0, file$1, 124, 4, 21669);
    			attr_dev(div1, "class", "surah");
    			add_location(div1, file$1, 99, 0, 2901);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			if (if_block0) if_block0.m(div1, null);
    			append_dev(div1, t0);
    			if (if_block1) if_block1.m(div1, null);
    			append_dev(div1, t1);
    			if (if_block2) if_block2.m(div1, null);
    			append_dev(div1, t2);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (window.outerWidth < 992) if_block0.p(ctx, dirty);

    			if (/*surahInfo*/ ctx[2]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_2(ctx);
    					if_block1.c();
    					if_block1.m(div1, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*loading*/ ctx[1]) {
    				if (if_block2) {
    					if (dirty & /*loading*/ 2) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_1(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(div1, t2);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}

    			if (dirty & /*surah*/ 1) {
    				each_value = /*surah*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (!current || dirty & /*loading*/ 2 && div0_style_value !== (div0_style_value = /*loading*/ ctx[1] ? 'display:none' : '')) {
    				attr_dev(div0, "style", div0_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block2);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block2);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(99:0) {#if showSurah }",
    		ctx
    	});

    	return block;
    }

    // (102:4) {#if window.outerWidth < 992}
    function create_if_block_3(ctx) {
    	let div;
    	let button;
    	let svg;
    	let path;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			button = element("button");
    			svg = svg_element("svg");
    			path = svg_element("path");
    			t = text("\r\n                Chapters");
    			attr_dev(path, "fill", "currentColor");
    			attr_dev(path, "d", "m8.5 12.8l5.7 5.6c.4.4 1 .4 1.4 0c.4-.4.4-1 0-1.4l-4.9-5l4.9-5c.4-.4.4-1 0-1.4c-.2-.2-.4-.3-.7-.3c-.3 0-.5.1-.7.3l-5.7 5.6c-.4.5-.4 1.1 0 1.6c0-.1 0-.1 0 0z");
    			add_location(path, file$1, 104, 167, 3235);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "aria-hidden", "true");
    			attr_dev(svg, "role", "img");
    			attr_dev(svg, "width", "1em");
    			attr_dev(svg, "height", "1em");
    			attr_dev(svg, "preserveAspectRatio", "xMidYMid meet");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			add_location(svg, file$1, 104, 16, 3084);
    			attr_dev(button, "type", "button");
    			attr_dev(button, "class", "btn");
    			add_location(button, file$1, 103, 12, 3012);
    			attr_dev(div, "class", "back__to-chapters");
    			add_location(div, file$1, 102, 8, 2967);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button);
    			append_dev(button, svg);
    			append_dev(svg, path);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*goBack*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(102:4) {#if window.outerWidth < 992}",
    		ctx
    	});

    	return block;
    }

    // (111:4) {#if surahInfo }
    function create_if_block_2(ctx) {
    	let header;
    	let div0;
    	let t0_value = /*surahInfo*/ ctx[2].name + "";
    	let t0;
    	let t1;
    	let div1;
    	let t2_value = /*surahInfo*/ ctx[2].name_translation + "";
    	let t2;
    	let t3;
    	let div2;
    	let svg;
    	let switch_1;
    	let g;
    	let path;

    	const block = {
    		c: function create() {
    			header = element("header");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			t2 = text(t2_value);
    			t3 = space();
    			div2 = element("div");
    			svg = svg_element("svg");
    			switch_1 = svg_element("switch");
    			g = svg_element("g");
    			path = svg_element("path");
    			attr_dev(div0, "class", "surah__title");
    			add_location(div0, file$1, 112, 8, 3575);
    			attr_dev(div1, "class", "surah__title_translation");
    			add_location(div1, file$1, 113, 8, 3633);
    			attr_dev(path, "fill", "currentColor");
    			attr_dev(path, "d", "M165.716 11.67c-.586-.089-1.021-.134-1.306-.134-.277 0-.644.273-1.099.818-.391.472-.586.781-.586.928a.217.217 0 0 0 .03.061c.012.016.03.024.055.024.008 0 .09-.063.244-.189s.301-.189.439-.189c.969 0 1.64.094 2.014.281-.357.26-.943.521-1.757.781-.659.211-.981.354-.965.427.024.081.366.094 1.025.037.651-.057 1.099-.143 1.343-.256.31-.146.667-.464 1.074-.952.439-.521.659-.932.659-1.233.002-.148-.389-.282-1.17-.404zm1.953 6.835c-.024 0-.092.13-.201.391-.11.26-.279.391-.507.391-.334 0-.501-.203-.501-.611 0-.179.051-.429.153-.75.102-.321.152-.535.152-.641 0-.065-.021-.105-.062-.122-.138-.073-.321.191-.549.793-.22.57-.329.989-.329 1.257 0 .277.081.546.243.807.188.284.411.427.672.427.342 0 .614-.179.817-.537.171-.301.257-.639.257-1.013.001-.277-.047-.408-.145-.392zm4.571 9.026c-.533-.271-.856-.408-.971-.408-.057 0-.207.258-.451.775-.244.516-.366.836-.366.958 0 .057.262.235.787.537.524.301.84.451.946.451.089 0 .254-.269.494-.806.239-.537.359-.879.359-1.025.001-.048-.266-.208-.798-.482zm2.203 3.449c-.058-.025-.92.346-2.588 1.11-1.701.781-2.648 1.257-2.844 1.429-.163.138-.362.361-.599.671-.284.366-.427.614-.427.745 0 .016.008.027.024.036-.073 0 .765-.411 2.515-1.233.919-.432 1.814-.846 2.685-1.244.163-.106.407-.338.732-.696.351-.391.525-.651.525-.781.002-.017-.007-.029-.023-.037zm-1.025-13.061c-1.074-2.034-1.733-3.051-1.978-3.051-.236 0-.354.504-.354 1.514 0 .35.04.785.122 1.306.089.545.166.818.231.818.122 0 .184-.403.184-1.208.398.529.956 1.489 1.672 2.881.789 1.529 1.184 2.502 1.184 2.917 0 .285-.211.428-.635.428-.301 0-.667-.062-1.099-.184-.488-.13-.817-.28-.988-.451.073-.488.041-.749-.098-.781-.114-.024-.293.265-.537.866-.244.603-.443.903-.598.903-.586 0-1.07-.142-1.453-.427.154-.521.244-.83.269-.928 0-.098-.028-.167-.085-.208-.106-.032-.257.114-.452.44-.261.438-.513.752-.757.939-.333.26-.813.391-1.44.391-.724 0-1.114-.057-1.171-.172.122-.072.237-.235.348-.488.109-.252.164-.459.164-.622 0-.098-.028-.15-.085-.158-.073-.017-.188.069-.342.256a2.502 2.502 0 0 1-.684.586c-.911.521-4.374 1.11-10.388 1.771-2.913.316-6.615.598-11.107.842-4.825.26-9.085.391-12.779.391-7.683 0-14.961-.342-21.837-1.025-2.971-.293-4.932-.537-5.884-.732-2.449-.496-4.142-1.266-5.078-2.307-.431-.48-.748-.717-.951-.708-.424.017-.854.415-1.294 1.196-.407.707-.61 1.298-.61 1.77 0 .326.187.659.562 1.001-2.222 1.603-3.942 2.815-5.163 3.638-.334.22-.484.357-.452.415.008.024.037.036.086.036.366 0 1.172-.252 2.416-.756 1.245-.506 2.011-.888 2.295-1.148.488-.447.903-1.082 1.245-1.904.269.18.738.362 1.41.55.671.187 1.166.272 1.482.257.098-.009.229-.257.391-.745 2.312.554 5.619 1.038 9.924 1.452 2.922.285 6.689.525 11.303.721 4.158.179 7.52.269 10.083.269 3.011 0 7.12-.163 12.328-.488 4.979-.31 9-.64 12.06-.989 4.833-.553 7.999-1.191 9.496-1.916a1.735 1.735 0 0 0-.085.439c0 .326.618.488 1.854.488.854 0 1.575-.342 2.161-1.025.586.473 1.232.708 1.94.708.398 0 .798-.603 1.196-1.807.212.188.582.432 1.11.732.627.358 1.059.537 1.294.537.236 0 .493-.179.77-.537.357-.472.537-1.082.537-1.831 0-1.052-.578-2.673-1.733-4.862zM96.61 4.59c-.109-.122-.229-.183-.359-.183-.847 0-1.567.635-2.161 1.904-.139-.008-.313-.063-.524-.165-.212-.102-.366-.152-.464-.152-.317 0-.647.22-.988.659-.31.399-.465.72-.465.964 0 .082.033.122.098.122.033 0 .161-.132.385-.397.224-.264.417-.396.58-.396.13 0 .34.071.629.213.288.143.563.214.823.214.684 0 1.29-.232 1.819-.696.528-.464.793-1.033.793-1.709a.566.566 0 0 0-.166-.378zm-1.788 10.669a1763.66 1763.66 0 0 0-.977-4.492c-.252-1.253-.406-1.879-.464-1.879-.235 0-.354.85-.354 2.551l.744 3.271c.529 2.278.858 3.812.989 4.601l.293 2.063c.105.7.183 1.05.231 1.05.236 0 .354-.766.354-2.295.003-.708-.271-2.332-.816-4.87zM85.998 6.91a7.41 7.41 0 0 0-.391 1.135c.879.968 1.363 2.079 1.453 3.332.024.366.061.549.109.549.18 0 .269-.435.269-1.306 0-1.383-.48-2.62-1.44-3.71zm2.514 6.298c-.081-.504-.188-.752-.317-.745-.105 0-.146.138-.122.415.032.326.024.529-.024.61a.632.632 0 0 1-.366.159c-.162.017-.276-.024-.342-.122-.032-.057-.057-.228-.073-.513-.008-.228-.053-.342-.134-.342-.082.017-.139.159-.171.427-.041.35-.077.562-.11.635-.105.236-.321.378-.646.427-.244 0-.395-.143-.452-.427 0-.089.028-.222.085-.397.057-.175.085-.303.085-.384 0-.065-.024-.11-.073-.134-.008-.008-.021-.012-.037-.012-.098 0-.236.24-.415.72-.13.342-.179.635-.146.879.073.578.391.838.952.781.293-.024.59-.228.891-.61.122.114.293.171.513.171.627 0 .94-.375.94-1.123a2.7 2.7 0 0 0-.038-.415zm-10.4-8.911c-.854 0-1.583.635-2.185 1.904-.114-.016-.279-.08-.494-.189-.216-.11-.38-.165-.495-.165-.301 0-.626.228-.977.684-.317.415-.476.741-.476.977 0 .089.032.134.098.134.041 0 .175-.134.402-.403.228-.269.427-.403.598-.403.123 0 .33.065.623.195s.559.196.794.196c.684 0 1.282-.22 1.794-.659.545-.472.818-1.042.818-1.709.001-.374-.166-.562-.5-.562zm13.793 16.82-1.953-5.053c-.057-.139-.114-.208-.171-.208-.017.008-.041.114-.073.317-.098.602-.146.976-.146 1.123 0 .391.336 1.402 1.007 3.033.672 1.632 1.008 2.565 1.008 2.802 0 .163-.139.244-.415.244a2 2 0 0 1-.317.024 1.862 1.862 0 0 1-1.526-.732c-.285-.358-.603-1.258-.952-2.697a485.636 485.636 0 0 1-.671-2.918c-.122-.521-.229-.781-.317-.781-.285.537-.428 1.046-.428 1.526 0 .114.062.407.184.879.423 1.644.635 2.707.635 3.186 0 .603-.24 1.074-.721 1.415-.423.302-.948.452-1.574.452-.977 0-1.53-.472-1.66-1.416-.049-.35-.073-1.126-.073-2.331 0-.659-.024-.989-.073-.989-.139 0-.269.273-.391.818a2.77 2.77 0 0 0-.073.599c0 .049-.354.24-1.062.573-.854.407-1.513.851-1.977 1.33-.277.285-.533.725-.769 1.318-.155.374-.057.655.293.843.26.139.598.207 1.013.207.903 0 1.501-.199 1.794-.598.024-.025.122-.191.293-.501.114-.212.232-.35.354-.415.033.773.183 1.339.452 1.697.439.586 1.042.879 1.807.879.806 0 1.465-.33 1.978-.989.276-.35.483-.769.622-1.257.098-.326.171-.518.22-.574.024.017.077.188.159.513.105.415.244.761.415 1.038.146.236.402.445.769.629.366.183.696.273.989.273.626 0 1.078-.346 1.354-1.037.138-.342.208-.875.208-1.599-.004-.715-.074-1.256-.212-1.623zm-10.247-7.665c-.542-.496-1.121-.745-1.739-.745-.261 0-.391.167-.391.5 0 .301.093.513.281.635-.09.236-.134.553-.134.952 0 .472.269.752.806.842-.285.407-.753.842-1.404 1.306a86.19 86.19 0 0 1-1.367.928c-.497.334-.724.545-.684.635.016.041.061.061.134.061.22 0 .626-.163 1.221-.488.562-.309 1.005-.59 1.331-.842.513-.398.984-.919 1.416-1.562.106 0 .271.047.495.14.224.094.376.14.458.14.261 0 .391-.28.391-.842-.002-.61-.273-1.163-.814-1.66zm15.679 16.075c-.203 0-.899.285-2.087.854-1.156.554-1.859.928-2.112 1.123-.398.399-.646.659-.744.781-.261.325-.366.524-.317.599.008.008.024.012.049.012a69.57 69.57 0 0 0 1.465-.793 95.53 95.53 0 0 1 2.941-1.404c.105-.081.269-.271.488-.567.22-.298.33-.494.33-.592 0-.009-.005-.013-.013-.013zM75.781 12.952c-.415-2.278-.639-3.548-.671-3.808-.073-.57-.154-.854-.244-.854-.041 0-.14.476-.299 1.428-.159.952-.222 1.514-.189 1.685.643 3.678 1.099 6.27 1.367 7.775.179 1.05.346 2.579.5 4.589.016.213.073.318.171.318.122 0 .183-.069.183-.208.154-.813.204-1.993.146-3.54-.057-1.701-.378-4.163-.964-7.385zm-5.859-7.556c-.049-.016-1.086.439-3.112 1.367-2.059.944-3.21 1.509-3.455 1.697-.146.114-.342.333-.586.659-.269.35-.403.59-.403.72 0 .024.008.037.024.037-.114 0 .712-.411 2.478-1.233 1.505-.7 2.775-1.278 3.808-1.733.163-.098.413-.336.751-.714.337-.378.506-.636.506-.775.001-.008-.003-.017-.011-.025zm-1.38 5.761c-.106-.569-.236-.842-.39-.818-.082.017-.123.085-.123.208 0 .082.012.202.037.36.024.159.037.279.037.36 0 .407-.171.61-.513.61a.33.33 0 0 1-.317-.195c-.024-.049-.062-.248-.11-.598-.041-.276-.102-.407-.183-.391-.09.017-.151.171-.183.464a8.914 8.914 0 0 1-.098.708c-.082.261-.305.411-.671.452-.261.065-.423-.077-.488-.427a1.056 1.056 0 0 1 .037-.403 2.17 2.17 0 0 0 .073-.415c0-.089-.024-.146-.073-.171-.017 0-.029-.004-.037-.012-.09 0-.232.265-.427.793-.09.391-.114.708-.073.952a.936.936 0 0 0 .366.623.842.842 0 0 0 .696.159c.447-.082.752-.305.916-.671a.788.788 0 0 0 .634.293c.635 0 .952-.427.952-1.282 0-.179-.021-.379-.062-.599zm11.536 16.4c-1.18.573-1.88.958-2.1 1.153-.448.398-.708.647-.781.744-.26.334-.354.537-.281.61a.052.052 0 0 0 .037.013c.049 0 .224-.09.525-.269.423-.252.732-.428.928-.525a216.721 216.721 0 0 1 2.966-1.416c.26-.195.5-.427.72-.695.269-.317.297-.477.085-.477-.22 0-.92.287-2.099.862zM59.547 7.3c-.586-.089-1.025-.134-1.318-.134-.277 0-.643.276-1.099.83-.399.48-.598.785-.598.916a.194.194 0 0 0 .037.048.08.08 0 0 0 .061.024c.016 0 .1-.062.25-.189.15-.126.291-.189.421-.189.195 0 .545.037 1.05.11.545.081.867.15.964.208-.358.244-.94.496-1.746.757-.659.211-.985.35-.977.415.024.057.167.085.427.085.83 0 1.477-.102 1.941-.305.301-.13.663-.444 1.086-.94.456-.521.684-.924.684-1.208.001-.164-.394-.306-1.183-.428zM72.4 16.271c-.57-3.222-.854-4.858-.854-4.907.26-.781.391-1.204.391-1.27-.008-.032-.082-.098-.22-.195-.383-.269-.598-.7-.647-1.294-.024-.261-.065-.391-.122-.391-.114 0-.252.293-.415.879-.146.529-.22.907-.22 1.135 0 .342.094.639.281.891l1.001 5.419c.651 3.516.977 5.525.977 6.03 0 .553-.464.83-1.392.83-.212 0-.362-.021-.452-.062a6.783 6.783 0 0 1-.769-.769c-.211.61-.403 1.232-.574 1.867.497.334.745.725.745 1.172 0 .285-.309.732-.928 1.343-1.286 1.27-2.754 1.904-4.406 1.904-.26 0-.647-.036-1.16-.11a8.954 8.954 0 0 0-1.147-.109c-.122 0-.183.032-.183.098 0 .146.277.361.83.646a8.06 8.06 0 0 0 1.233.537c.952.326 1.624.488 2.014.488.683 0 1.518-.464 2.502-1.391 1.123-1.059 1.798-2.242 2.026-3.553.781 0 1.375-.357 1.782-1.074.342-.586.513-1.298.513-2.136 0-.948-.269-2.942-.806-5.978zm-19.261-8.47c-.155.35-.285.724-.391 1.123.545.594.932 1.229 1.159 1.904.13.399.22.875.269 1.428.032.375.073.562.122.562.188 0 .281-.435.281-1.306 0-1.384-.48-2.621-1.44-3.711zM50.38 4.334c-.822 0-1.542.635-2.16 1.904-.146-.008-.324-.069-.531-.183-.208-.114-.36-.171-.458-.171-.317 0-.647.224-.989.671-.31.399-.464.729-.464.989 0 .089.037.134.11.134.041 0 .171-.134.391-.403s.407-.403.562-.403c.138 0 .352.065.641.195.289.13.56.195.812.195.692 0 1.3-.226 1.825-.678.525-.451.787-1.015.787-1.69-.001-.373-.177-.56-.526-.56zm2.325 10.791c-.525-.293-.84-.439-.946-.439-.082 0-.208.24-.378.72-.171.48-.256.793-.256.939 0 .122.23.33.69.623.459.292.758.439.897.439.081 0 .232-.264.452-.793s.33-.854.33-.976c-.001-.05-.264-.221-.789-.513zm-4.095-2.1c-.383-1.847-.631-3.121-.745-3.821-.089-.537-.183-.805-.281-.805-.041 0-.13.478-.268 1.434-.139.956-.191 1.516-.159 1.678a860.271 860.271 0 0 0 1.379 7.031c.211 1.14.403 2.669.574 4.59.049.212.118.317.208.317.065 0 .122-.082.171-.244.13-.847.155-2.014.073-3.504-.098-1.83-.415-4.056-.952-6.676zm-8.129-1.55c-.106-.569-.236-.842-.391-.818-.082.017-.122.085-.122.208 0 .082.014.202.042.36s.043.279.043.36c0 .407-.175.61-.525.61-.139 0-.244-.065-.317-.195a12.877 12.877 0 0 1-.085-.476l-.012-.122c-.041-.269-.102-.398-.183-.391-.098.017-.163.171-.195.464-.041.432-.069.667-.085.708-.082.261-.305.411-.671.452-.261.065-.427-.073-.5-.415-.017-.081-.002-.226.043-.433.044-.208.067-.344.067-.409 0-.089-.024-.15-.073-.183-.09-.049-.244.22-.464.806-.09.35-.11.667-.061.952.081.529.362.793.842.793.529 0 .907-.228 1.135-.684a.753.753 0 0 0 .623.293c.635 0 .952-.427.952-1.282a3.583 3.583 0 0 0-.063-.598zm15.422 17.552c-1.176.562-1.874.939-2.093 1.135a7.49 7.49 0 0 0-.745.781c-.277.334-.383.533-.317.598.008 0 .513-.26 1.514-.781a94.169 94.169 0 0 1 2.941-1.402c.285-.229.525-.461.72-.696.26-.317.289-.476.085-.476-.227 0-.929.28-2.105.841zM44.667 13.708c-.659-3.613-1.079-5.383-1.257-5.31-.22.089-.395.691-.525 1.806a17.57 17.57 0 0 0-.146 2.039c0 1.359.065 2.576.195 3.65.114.96.228 1.44.342 1.44.057 0 .085-.24.085-.72l-.073-2.587c-.024-1.196-.004-2.095.061-2.698l.891 4.651c.513 2.685.769 4.281.769 4.785 0 .252-.261.428-.781.525-.472.089-.802.094-.989.012-.309-.229-.533-.419-.671-.574-.269-.179-.48.033-.635.635-.163.595-.126 1.01.11 1.246.537.422.806.821.806 1.195 0 .619-.496 1.335-1.489 2.148-1.042.854-2.018 1.281-2.929 1.281-.912 0-1.546-.293-1.904-.879-.179-.293-.297-.756-.354-1.391-.049-.537-.106-.807-.171-.807-.171 0-.256.334-.256 1.002 0 .635.118 1.221.354 1.758.594 1.342 1.57 2.014 2.93 2.014 1.123 0 2.177-.68 3.161-2.039.928-1.277 1.371-2.461 1.331-3.552.83-.073 1.412-.407 1.746-1.001.252-.455.378-1.143.378-2.062-.002-.83-.328-3.019-.979-6.567zm-14.452-6.2c-6.274 1.57-10.225 2.75-11.852 3.54-.79.383-1.433.863-1.929 1.44-.399.464-.598.814-.598 1.05 0 .049.021.073.061.073-.016-.008.171-.142.562-.403.545-.366 1.298-.732 2.258-1.099 2.596-.993 5.989-1.994 10.18-3.002 4.28-1.034 8.78-2.071 13.5-3.113.529-.545.985-1.042 1.367-1.489-3.214.545-7.73 1.546-13.549 3.003zm35.325 8.593c-.407-.163-1.249-.578-2.527-1.245-.675-.35-1.293-.525-1.855-.525-1.058 0-1.791.5-2.197 1.501-.049.171-.094.342-.134.512a23.147 23.147 0 0 1 1.575-.061c.586 0 1.062.032 1.428.098.439.122 1.038.333 1.794.634-2.628.35-4.357.916-5.188 1.697-.204.188-.497.586-.879 1.196-.366.569-.627.915-.781 1.038-.358.284-.903.427-1.636.427-.333 0-.563-.047-.689-.141-.126-.093-.285-.308-.476-.641s-.352-.558-.482-.671c-.065-.058-.214.199-.446.769s-.262.973-.091 1.208c.496.66.745 1.294.745 1.904 0 1.855-2.673 3.801-8.02 5.835-4.378 1.668-9.313 2.502-14.806 2.502-5.477 0-10.306-1.106-14.489-3.319a18.333 18.333 0 0 1-3.039-2.027 24.436 24.436 0 0 1-1.831-1.696c-.448-.456-.7-.663-.757-.622-.008.008-.012.028-.012.061 0 .342.452 1.188 1.355 2.539 1.001 1.497 1.908 2.539 2.722 3.125 1.53 1.098 3.593 2.01 6.188 2.734 2.995.838 6.189 1.257 9.582 1.257 5.696 0 11.197-1.119 16.503-3.356 4.605-1.938 7.087-4.48 7.445-7.629.122.008.236.012.342.012 1.05 0 1.843-.557 2.38-1.672.789.96 1.782 1.44 2.979 1.44.333 0 .63-.302.891-.903.228-.521.341-.973.341-1.355 0-.602-.297-1.154-.891-1.66.391-.17 1.074-.354 2.05-.549 1.09-.22 2.01-.33 2.759-.33 1.204 0 2.547.249 4.028.745.822-.968 1.212-1.453 1.172-1.453-2.254-.472-3.938-.932-5.053-1.379zm-49.618-9.02c-.578-.089-1.013-.134-1.306-.134-.285 0-.655.276-1.11.83-.383.472-.574.777-.574.916 0 .057.024.085.073.085.016 0 .1-.063.25-.189s.287-.189.409-.189c.212 0 .566.032 1.062.098.537.081.867.155.989.22-.358.244-.944.496-1.757.756-.667.212-.989.346-.964.403.006.064.153.096.438.096.822 0 1.465-.089 1.929-.268.301-.155.659-.48 1.074-.977.439-.529.659-.936.659-1.221 0-.162-.391-.304-1.172-.426zm6.042 8.495a11.1 11.1 0 0 0-.11.549c-.073.334-.248.501-.525.501-.512 0-.769-.399-.769-1.196 0-.073.004-.183.012-.33.008-.146.012-.256.012-.33 0-.163-.024-.248-.073-.256-.106-.016-.204.228-.293.732a5.963 5.963 0 0 0-.122 1.025c0 .383.089.737.269 1.062.211.383.496.574.854.574.325 0 .582-.175.769-.525.146-.285.22-.606.22-.964 0-.626-.081-.907-.244-.842zm7.25 7.738c-.016-.016-.083.137-.201.458-.118.321-.177.519-.177.592 0 .024.008.049.024.073.838.92 1.314 2.03 1.428 3.332.032.375.073.562.122.562.163 0 .244-.428.244-1.282.001-1.399-.479-2.644-1.44-3.735zm8.899-6.078c-.797-.203-1.77-.525-2.917-.964-.854-.325-1.367-.488-1.538-.488-.7 0-1.257.313-1.672.939-.301.456-.452.854-.452 1.196 0 .024.004.041.012.049.358-.032.716-.049 1.074-.049 1.44 0 2.791.252 4.052.757-1.603.855-2.832 1.282-3.686 1.282-.48 0-.863-.118-1.147-.354-.195-.162-.293-.305-.293-.427 0 .058.02-.053.061-.33.024-.154-.008-.244-.098-.269-.057-.016-.188.09-.391.317-.277.317-.643.574-1.099.769-.968.415-2.437.785-4.406 1.11-2.238.367-4.492.55-6.762.55-4.134 0-6.958-.834-8.471-2.502-.439-.48-.749-.716-.928-.708-.448.017-.887.411-1.318 1.184-.39.7-.585 1.294-.585 1.782 0 .325.187.655.561.989-2.14 1.545-3.857 2.75-5.151 3.612-.342.228-.497.378-.464.452.008.023.041.036.098.036.358 0 1.166-.254 2.423-.763 1.257-.509 2.021-.889 2.289-1.142.48-.439.891-1.078 1.233-1.916.277.171.753.354 1.428.549s1.164.285 1.465.269c.203-.064.358-.338.464-.817 1.131.569 3.121.854 5.969.854 2.954 0 5.7-.261 8.239-.781 2.832-.578 4.447-1.33 4.846-2.258.496.968 1.038 1.452 1.624 1.452.415 0 1.615-.407 3.601-1.221s3.41-1.221 4.272-1.221c.667 0 1.293.081 1.879.244.065.017.256-.265.574-.842.26-.48.391-.757.391-.83 0-.016-.004-.024-.012-.024-2.183.002-3.904-.16-5.165-.486zm-15.118 7.116c-.565-.268-.885-.391-.958-.365-.26.455-.472.891-.635 1.306l-1.05-.464c-.431-.188-.683-.269-.756-.244-.082.024-.214.301-.397.83s-.262.842-.238.939c.016.065.293.223.83.471.537.248.863.372.977.372.098 0 .31-.436.635-1.306.977.545 1.554.793 1.733.744.073-.024.224-.303.452-.836s.325-.844.293-.934c-.025-.074-.32-.244-.886-.513zm-14.72 4.822c-1.176.562-1.882.943-2.118 1.147-.896.765-1.245 1.208-1.05 1.33.008.009.024.013.049.013.122-.09.614-.354 1.477-.794a180.24 180.24 0 0 1 2.93-1.416c.244-.146.488-.362.732-.646.269-.317.297-.476.085-.476-.228 0-.929.28-2.105.842zM95.494 6.238c-.375.122-.7.171-.977.146.431-.781.842-1.172 1.232-1.172.285 0 .428.143.428.427.001.245-.228.445-.683.599zm.61 17.284c0-.106.081-.251.244-.434.162-.183.293-.274.391-.274.081-.008.231.188.451.586.276.504.517.85.721 1.037-1.205-.251-1.807-.556-1.807-.915zM77.331 6.128c-.375.122-.7.171-.977.146.415-.797.826-1.196 1.233-1.196.285 0 .427.151.427.452.001.244-.227.444-.683.598zm4.663 8.935c-.13 0-.35-.053-.66-.159.041-.171.062-.322.062-.452a.74.74 0 0 0-.062-.33c.114.016.285.146.513.391.187.204.28.35.28.439a.114.114 0 0 1-.012.049c-.008.042-.048.062-.121.062zm-1.196-.231c-.448 0-.671-.085-.671-.256 0-.374.13-.562.391-.562.236 0 .354.143.354.427a1.287 1.287 0 0 1-.074.391zm2.306 7.628a3.531 3.531 0 0 1-1.916.366c-.375-.032-.562-.085-.562-.158 0-.154.838-.659 2.514-1.514-.023.211-.036.647-.036 1.306zM49.623 6.153c-.382.13-.708.183-.977.159.432-.781.842-1.172 1.233-1.172.285 0 .427.143.427.427.001.236-.227.432-.683.586zm10.705 15.05c-.358 0-.777-.135-1.257-.402a2.052 2.052 0 0 1-.5-.391c-.195-.204-.252-.367-.171-.488.057-.074.208-.102.452-.086.269.024.496.086.684.184.643.342.964.699.964 1.074-.001.072-.058.109-.172.109zM8.745 19.922c0-.105.082-.252.244-.439s.297-.289.403-.306c.073 0 .22.204.439.61.269.505.509.854.72 1.05-1.204-.252-1.806-.558-1.806-.915z");
    			add_location(path, file$1, 115, 167, 3914);
    			add_location(g, file$1, 115, 164, 3911);
    			add_location(switch_1, file$1, 115, 156, 3903);
    			attr_dev(svg, "baseProfile", "tiny");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "width", "220");
    			attr_dev(svg, "height", "45");
    			attr_dev(svg, "viewBox", "0 0 176 36");
    			attr_dev(svg, "overflow", "inherit");
    			attr_dev(svg, "xml:space", "preserve");
    			add_location(svg, file$1, 115, 12, 3759);
    			attr_dev(div2, "class", "surah__bismillah");
    			add_location(div2, file$1, 114, 8, 3715);
    			attr_dev(header, "class", "surah__header");
    			add_location(header, file$1, 111, 4, 3535);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, div0);
    			append_dev(div0, t0);
    			append_dev(header, t1);
    			append_dev(header, div1);
    			append_dev(div1, t2);
    			append_dev(header, t3);
    			append_dev(header, div2);
    			append_dev(div2, svg);
    			append_dev(svg, switch_1);
    			append_dev(switch_1, g);
    			append_dev(g, path);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*surahInfo*/ 4 && t0_value !== (t0_value = /*surahInfo*/ ctx[2].name + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*surahInfo*/ 4 && t2_value !== (t2_value = /*surahInfo*/ ctx[2].name_translation + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(111:4) {#if surahInfo }",
    		ctx
    	});

    	return block;
    }

    // (121:4) {#if loading }
    function create_if_block_1(ctx) {
    	let loading_1;
    	let current;
    	loading_1 = new Loading({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(loading_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(loading_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(loading_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(loading_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(loading_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(121:4) {#if loading }",
    		ctx
    	});

    	return block;
    }

    // (150:16) {#each verse.translations as translation, i }
    function create_each_block_1(ctx) {
    	let div2;
    	let div0;
    	let raw0_value = /*translation*/ ctx[12].text.replace(/<\/?[a-z][a-z0-9]*[^<>]*>.*?<\/?[a-z][a-z0-9]*[^<>]*>/ig, "") + "";
    	let t0;
    	let div1;
    	let raw1_value = /*translation*/ ctx[12].resource_name.replace(/<\/?[a-z][a-z0-9]*[^<>]*>.*?<\/?[a-z][a-z0-9]*[^<>]*>/ig, "") + "";
    	let t1;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			t1 = space();
    			attr_dev(div0, "class", "translation__text");
    			add_location(div0, file$1, 151, 20, 24532);
    			attr_dev(div1, "class", "translation__author");
    			add_location(div1, file$1, 152, 20, 24687);
    			attr_dev(div2, "class", "verse__translation");
    			add_location(div2, file$1, 150, 16, 24478);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			div0.innerHTML = raw0_value;
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			div1.innerHTML = raw1_value;
    			append_dev(div2, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*surah*/ 1 && raw0_value !== (raw0_value = /*translation*/ ctx[12].text.replace(/<\/?[a-z][a-z0-9]*[^<>]*>.*?<\/?[a-z][a-z0-9]*[^<>]*>/ig, "") + "")) div0.innerHTML = raw0_value;			if (dirty & /*surah*/ 1 && raw1_value !== (raw1_value = /*translation*/ ctx[12].resource_name.replace(/<\/?[a-z][a-z0-9]*[^<>]*>.*?<\/?[a-z][a-z0-9]*[^<>]*>/ig, "") + "")) div1.innerHTML = raw1_value;		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(150:16) {#each verse.translations as translation, i }",
    		ctx
    	});

    	return block;
    }

    // (127:8) {#each surah as verse, i }
    function create_each_block(ctx) {
    	let div5;
    	let div2;
    	let div0;
    	let span;
    	let t0_value = /*verse*/ ctx[9].verse_key + "";
    	let t0;
    	let t1;
    	let div1;
    	let button0;
    	let svg0;
    	let path0;
    	let t2;
    	let button1;
    	let svg1;
    	let path1;
    	let t3;
    	let button2;
    	let svg2;
    	let path2;
    	let path3;
    	let path4;
    	let t4;
    	let div4;
    	let div3;
    	let img;
    	let img_data_src_value;
    	let img_alt_value;
    	let t5;
    	let t6;
    	let each_value_1 = /*verse*/ ctx[9].translations;
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			button0 = element("button");
    			svg0 = svg_element("svg");
    			path0 = svg_element("path");
    			t2 = space();
    			button1 = element("button");
    			svg1 = svg_element("svg");
    			path1 = svg_element("path");
    			t3 = space();
    			button2 = element("button");
    			svg2 = svg_element("svg");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			t4 = space();
    			div4 = element("div");
    			div3 = element("div");
    			img = element("img");
    			t5 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t6 = space();
    			attr_dev(span, "class", "verse__no");
    			add_location(span, file$1, 130, 20, 21902);
    			attr_dev(div0, "class", "verse__left");
    			add_location(div0, file$1, 129, 16, 21855);
    			attr_dev(path0, "fill", "currentColor");
    			attr_dev(path0, "d", "M23 20a5 5 0 0 0-3.89 1.89l-7.31-4.57a4.46 4.46 0 0 0 0-2.64l7.31-4.57A5 5 0 1 0 18 7a4.79 4.79 0 0 0 .2 1.32l-7.31 4.57a5 5 0 1 0 0 6.22l7.31 4.57A4.79 4.79 0 0 0 18 25a5 5 0 1 0 5-5Zm0-16a3 3 0 1 1-3 3a3 3 0 0 1 3-3ZM7 19a3 3 0 1 1 3-3a3 3 0 0 1-3 3Zm16 9a3 3 0 1 1 3-3a3 3 0 0 1-3 3Z");
    			add_location(path0, file$1, 134, 175, 22260);
    			attr_dev(svg0, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg0, "aria-hidden", "true");
    			attr_dev(svg0, "role", "img");
    			attr_dev(svg0, "width", "1em");
    			attr_dev(svg0, "height", "1em");
    			attr_dev(svg0, "preserveAspectRatio", "xMidYMid meet");
    			attr_dev(svg0, "viewBox", "0 0 32 32");
    			add_location(svg0, file$1, 134, 24, 22109);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "verse__share");
    			add_location(button0, file$1, 133, 20, 22040);
    			attr_dev(path1, "fill", "currentColor");
    			attr_dev(path1, "d", "M7 28a1 1 0 0 1-1-1V5a1 1 0 0 1 1.482-.876l20 11a1 1 0 0 1 0 1.752l-20 11A1 1 0 0 1 7 28ZM8 6.69v18.62L24.925 16Z");
    			add_location(path1, file$1, 137, 175, 22856);
    			attr_dev(svg1, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg1, "aria-hidden", "true");
    			attr_dev(svg1, "role", "img");
    			attr_dev(svg1, "width", "1em");
    			attr_dev(svg1, "height", "1em");
    			attr_dev(svg1, "preserveAspectRatio", "xMidYMid meet");
    			attr_dev(svg1, "viewBox", "0 0 32 32");
    			add_location(svg1, file$1, 137, 24, 22705);
    			attr_dev(button1, "type", "button");
    			attr_dev(button1, "class", "verse__play");
    			add_location(button1, file$1, 136, 20, 22637);
    			attr_dev(path2, "fill", "currentColor");
    			attr_dev(path2, "d", "m17.6 24.32l-2.46 2.44a4 4 0 0 1-5.62 0a3.92 3.92 0 0 1 0-5.55l4.69-4.65a4 4 0 0 1 5.62 0a3.86 3.86 0 0 1 1 1.71a2 2 0 0 0 .27-.27l1.29-1.28a5.89 5.89 0 0 0-1.15-1.62a6 6 0 0 0-8.44 0l-4.7 4.69a5.91 5.91 0 0 0 0 8.39a6 6 0 0 0 8.44 0l3.65-3.62h-.5a8 8 0 0 1-2.09-.24Z");
    			attr_dev(path2, "class", "clr-i-outline clr-i-outline-path-1");
    			add_location(path2, file$1, 140, 175, 23284);
    			attr_dev(path3, "fill", "currentColor");
    			attr_dev(path3, "d", "M28.61 7.82a6 6 0 0 0-8.44 0l-3.65 3.62h.49a8 8 0 0 1 2.1.28l2.46-2.44a4 4 0 0 1 5.62 0a3.92 3.92 0 0 1 0 5.55l-4.69 4.65a4 4 0 0 1-5.62 0a3.86 3.86 0 0 1-1-1.71a2 2 0 0 0-.28.23l-1.29 1.28a5.89 5.89 0 0 0 1.15 1.62a6 6 0 0 0 8.44 0l4.69-4.65a5.92 5.92 0 0 0 0-8.39Z");
    			attr_dev(path3, "class", "clr-i-outline clr-i-outline-path-2");
    			add_location(path3, file$1, 140, 517, 23626);
    			attr_dev(path4, "fill", "none");
    			attr_dev(path4, "d", "M0 0h36v36H0z");
    			add_location(path4, file$1, 140, 858, 23967);
    			attr_dev(svg2, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg2, "aria-hidden", "true");
    			attr_dev(svg2, "role", "img");
    			attr_dev(svg2, "width", "1em");
    			attr_dev(svg2, "height", "1em");
    			attr_dev(svg2, "preserveAspectRatio", "xMidYMid meet");
    			attr_dev(svg2, "viewBox", "0 0 36 36");
    			add_location(svg2, file$1, 140, 24, 23133);
    			attr_dev(button2, "type", "button");
    			attr_dev(button2, "class", "verse__copy-link");
    			add_location(button2, file$1, 139, 20, 23060);
    			attr_dev(div1, "class", "verse__right");
    			add_location(div1, file$1, 132, 16, 21992);
    			attr_dev(div2, "class", "verse__topbar");
    			add_location(div2, file$1, 128, 12, 21810);
    			attr_dev(img, "class", "lazyload");
    			attr_dev(img, "data-src", img_data_src_value = "https://df61994948e9a54a5259-ad04094bac72ed4d481dba65a1920e88.ssl.cf1.rackcdn.com/" + /*verse*/ ctx[9].verse_key.replace(':', '_') + ".png");
    			attr_dev(img, "alt", img_alt_value = /*verse*/ ctx[9].verse_key);
    			add_location(img, file$1, 146, 20, 24192);
    			attr_dev(div3, "class", "verse__arabic");
    			add_location(div3, file$1, 145, 16, 24143);
    			attr_dev(div4, "class", "verse__inner");
    			add_location(div4, file$1, 144, 12, 24099);
    			attr_dev(div5, "class", "verse");
    			add_location(div5, file$1, 127, 8, 21777);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div2);
    			append_dev(div2, div0);
    			append_dev(div0, span);
    			append_dev(span, t0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, button0);
    			append_dev(button0, svg0);
    			append_dev(svg0, path0);
    			append_dev(div1, t2);
    			append_dev(div1, button1);
    			append_dev(button1, svg1);
    			append_dev(svg1, path1);
    			append_dev(div1, t3);
    			append_dev(div1, button2);
    			append_dev(button2, svg2);
    			append_dev(svg2, path2);
    			append_dev(svg2, path3);
    			append_dev(svg2, path4);
    			append_dev(div5, t4);
    			append_dev(div5, div4);
    			append_dev(div4, div3);
    			append_dev(div3, img);
    			append_dev(div4, t5);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div4, null);
    			}

    			append_dev(div5, t6);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*surah*/ 1 && t0_value !== (t0_value = /*verse*/ ctx[9].verse_key + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*surah*/ 1 && img_data_src_value !== (img_data_src_value = "https://df61994948e9a54a5259-ad04094bac72ed4d481dba65a1920e88.ssl.cf1.rackcdn.com/" + /*verse*/ ctx[9].verse_key.replace(':', '_') + ".png")) {
    				attr_dev(img, "data-src", img_data_src_value);
    			}

    			if (dirty & /*surah*/ 1 && img_alt_value !== (img_alt_value = /*verse*/ ctx[9].verse_key)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*surah*/ 1) {
    				each_value_1 = /*verse*/ ctx[9].translations;
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div4, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(127:8) {#each surah as verse, i }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*showSurah*/ ctx[3] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*showSurah*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*showSurah*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Surah', slots, []);
    	const dispatch = createEventDispatcher();
    	let surah = [];
    	let currentSurah = null;
    	let loading = false;
    	var chapters = [];
    	var surahInfo = {};
    	var showSurah = true;

    	var showChaptersCB = () => {
    		if (window.outerWidth > 991) {
    			$$invalidate(3, showSurah = true);
    		} else {
    			if (currentSurah === null) {
    				$$invalidate(3, showSurah = false);
    				return;
    			}

    			$$invalidate(3, showSurah = true);
    		}
    	};

    	showChaptersCB();

    	data$1.subscribe(async object => {
    		if (object.currentSurah === null) {
    			return;
    		}

    		currentSurah = object.currentSurah;
    		showChaptersCB();

    		if (object.surah[currentSurah] === undefined || object.surah[currentSurah] === 'undefined') {
    			var quranCDN = 'https://api.qurancdn.com/api/qdc/verses/by_chapter/' + currentSurah + '?words=true&translation_fields=resource_name%2Clanguage_id&per_page=500&fields=chapter_id&translations=20%2C131&reciter=7&word_translation_language=en&page=1&word_fields=verse_key%2Cverse_id%2Cpage_number%2Clocation%2Ctext_uthmani%2Ctajweed%2Cqpc_uthmani_hafs&mushaf=11';
    			$$invalidate(1, loading = true);

    			await axios.get(quranCDN).then(function (resp) {
    				var verses = resp.data.verses;
    				var data = [];

    				verses.forEach(verse => {
    					data.push({
    						'chapter_id': verse.chapter_id,
    						'verse_key': verse.verse_key,
    						'translations': verse.translations
    					});
    				});

    				object.surah[currentSurah] = data;
    			}).catch(function (error) {
    				console.log(error);
    			});
    		}

    		$$invalidate(0, surah = object.surah[currentSurah]);
    		$$invalidate(1, loading = false);
    		showChaptersCB();
    	});

    	data$1.subscribe(object => {
    		chapters = object.chapters;

    		if (chapters === undefined || chapters === 'undefined') {
    			return;
    		}

    		var current = chapters.filter(item => {
    			return item.id == currentSurah;
    		});

    		if (!current.length) {
    			return;
    		}

    		$$invalidate(2, surahInfo.name = current[0].name_simple, surahInfo);
    		$$invalidate(2, surahInfo.name_translation = current[0].translated_name.name, surahInfo);
    	});

    	var goBack = () => {
    		window.location.reload();
    	};

    	afterUpdate(() => {
    		var surah = document.querySelector('.surah');
    		currentSurah !== null && surah && surah.scrollTo(0, 0);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Surah> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		axios,
    		Loading,
    		beforeUpdate,
    		afterUpdate,
    		createEventDispatcher,
    		data: data$1,
    		dispatch,
    		surah,
    		currentSurah,
    		loading,
    		chapters,
    		surahInfo,
    		showSurah,
    		showChaptersCB,
    		goBack
    	});

    	$$self.$inject_state = $$props => {
    		if ('surah' in $$props) $$invalidate(0, surah = $$props.surah);
    		if ('currentSurah' in $$props) currentSurah = $$props.currentSurah;
    		if ('loading' in $$props) $$invalidate(1, loading = $$props.loading);
    		if ('chapters' in $$props) chapters = $$props.chapters;
    		if ('surahInfo' in $$props) $$invalidate(2, surahInfo = $$props.surahInfo);
    		if ('showSurah' in $$props) $$invalidate(3, showSurah = $$props.showSurah);
    		if ('showChaptersCB' in $$props) showChaptersCB = $$props.showChaptersCB;
    		if ('goBack' in $$props) $$invalidate(4, goBack = $$props.goBack);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [surah, loading, surahInfo, showSurah, goBack];
    }

    class Surah extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Surah",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.49.0 */

    const { console: console_1 } = globals;
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let div1;
    	let header;
    	let t0;
    	let main;
    	let div0;
    	let sidebar;
    	let t1;
    	let surah;
    	let current;
    	header = new Header({ $$inline: true });
    	sidebar = new Sidebar({ $$inline: true });
    	surah = new Surah({ $$inline: true });

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			create_component(header.$$.fragment);
    			t0 = space();
    			main = element("main");
    			div0 = element("div");
    			create_component(sidebar.$$.fragment);
    			t1 = space();
    			create_component(surah.$$.fragment);
    			attr_dev(div0, "class", "content__inner");
    			add_location(div0, file, 40, 2, 794);
    			attr_dev(main, "class", "main-content");
    			add_location(main, file, 39, 1, 764);
    			attr_dev(div1, "id", "app");
    			add_location(div1, file, 36, 0, 736);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			mount_component(header, div1, null);
    			append_dev(div1, t0);
    			append_dev(div1, main);
    			append_dev(main, div0);
    			mount_component(sidebar, div0, null);
    			append_dev(div0, t1);
    			mount_component(surah, div0, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(sidebar.$$.fragment, local);
    			transition_in(surah.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(sidebar.$$.fragment, local);
    			transition_out(surah.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(header);
    			destroy_component(sidebar);
    			destroy_component(surah);
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	var chapters = [];

    	onMount(() => {
    		if (chapters.length === 0) {
    			axios.get('https://api.quran.com/api/v3/chapters').then(function (resp) {
    				data$1.update(object => {
    					object.chapters = resp.data.chapters;
    					return object;
    				});
    			}).catch(function (error) {
    				console.log(error);
    			});
    		}
    	});

    	var unsub = data$1.subscribe(object => {
    		chapters = object.chapters;
    	});

    	onDestroy(() => {
    		unsub();
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onMount,
    		onDestroy,
    		data: data$1,
    		axios,
    		Header,
    		Sidebar,
    		Surah,
    		chapters,
    		unsub
    	});

    	$$self.$inject_state = $$props => {
    		if ('chapters' in $$props) chapters = $$props.chapters;
    		if ('unsub' in $$props) unsub = $$props.unsub;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    var lazysizes = createCommonjsModule(function (module) {
    (function(window, factory) {
    	var lazySizes = factory(window, window.document, Date);
    	window.lazySizes = lazySizes;
    	if(module.exports){
    		module.exports = lazySizes;
    	}
    }(typeof window != 'undefined' ?
          window : {}, 
    /**
     * import("./types/global")
     * @typedef { import("./types/lazysizes-config").LazySizesConfigPartial } LazySizesConfigPartial
     */
    function l(window, document, Date) { // Pass in the window Date function also for SSR because the Date class can be lost
    	/*jshint eqnull:true */

    	var lazysizes,
    		/**
    		 * @type { LazySizesConfigPartial }
    		 */
    		lazySizesCfg;

    	(function(){
    		var prop;

    		var lazySizesDefaults = {
    			lazyClass: 'lazyload',
    			loadedClass: 'lazyloaded',
    			loadingClass: 'lazyloading',
    			preloadClass: 'lazypreload',
    			errorClass: 'lazyerror',
    			//strictClass: 'lazystrict',
    			autosizesClass: 'lazyautosizes',
    			fastLoadedClass: 'ls-is-cached',
    			iframeLoadMode: 0,
    			srcAttr: 'data-src',
    			srcsetAttr: 'data-srcset',
    			sizesAttr: 'data-sizes',
    			//preloadAfterLoad: false,
    			minSize: 40,
    			customMedia: {},
    			init: true,
    			expFactor: 1.5,
    			hFac: 0.8,
    			loadMode: 2,
    			loadHidden: true,
    			ricTimeout: 0,
    			throttleDelay: 125,
    		};

    		lazySizesCfg = window.lazySizesConfig || window.lazysizesConfig || {};

    		for(prop in lazySizesDefaults){
    			if(!(prop in lazySizesCfg)){
    				lazySizesCfg[prop] = lazySizesDefaults[prop];
    			}
    		}
    	})();

    	if (!document || !document.getElementsByClassName) {
    		return {
    			init: function () {},
    			/**
    			 * @type { LazySizesConfigPartial }
    			 */
    			cfg: lazySizesCfg,
    			/**
    			 * @type { true }
    			 */
    			noSupport: true,
    		};
    	}

    	var docElem = document.documentElement;

    	var supportPicture = window.HTMLPictureElement;

    	var _addEventListener = 'addEventListener';

    	var _getAttribute = 'getAttribute';

    	/**
    	 * Update to bind to window because 'this' becomes null during SSR
    	 * builds.
    	 */
    	var addEventListener = window[_addEventListener].bind(window);

    	var setTimeout = window.setTimeout;

    	var requestAnimationFrame = window.requestAnimationFrame || setTimeout;

    	var requestIdleCallback = window.requestIdleCallback;

    	var regPicture = /^picture$/i;

    	var loadEvents = ['load', 'error', 'lazyincluded', '_lazyloaded'];

    	var regClassCache = {};

    	var forEach = Array.prototype.forEach;

    	/**
    	 * @param ele {Element}
    	 * @param cls {string}
    	 */
    	var hasClass = function(ele, cls) {
    		if(!regClassCache[cls]){
    			regClassCache[cls] = new RegExp('(\\s|^)'+cls+'(\\s|$)');
    		}
    		return regClassCache[cls].test(ele[_getAttribute]('class') || '') && regClassCache[cls];
    	};

    	/**
    	 * @param ele {Element}
    	 * @param cls {string}
    	 */
    	var addClass = function(ele, cls) {
    		if (!hasClass(ele, cls)){
    			ele.setAttribute('class', (ele[_getAttribute]('class') || '').trim() + ' ' + cls);
    		}
    	};

    	/**
    	 * @param ele {Element}
    	 * @param cls {string}
    	 */
    	var removeClass = function(ele, cls) {
    		var reg;
    		if ((reg = hasClass(ele,cls))) {
    			ele.setAttribute('class', (ele[_getAttribute]('class') || '').replace(reg, ' '));
    		}
    	};

    	var addRemoveLoadEvents = function(dom, fn, add){
    		var action = add ? _addEventListener : 'removeEventListener';
    		if(add){
    			addRemoveLoadEvents(dom, fn);
    		}
    		loadEvents.forEach(function(evt){
    			dom[action](evt, fn);
    		});
    	};

    	/**
    	 * @param elem { Element }
    	 * @param name { string }
    	 * @param detail { any }
    	 * @param noBubbles { boolean }
    	 * @param noCancelable { boolean }
    	 * @returns { CustomEvent }
    	 */
    	var triggerEvent = function(elem, name, detail, noBubbles, noCancelable){
    		var event = document.createEvent('Event');

    		if(!detail){
    			detail = {};
    		}

    		detail.instance = lazysizes;

    		event.initEvent(name, !noBubbles, !noCancelable);

    		event.detail = detail;

    		elem.dispatchEvent(event);
    		return event;
    	};

    	var updatePolyfill = function (el, full){
    		var polyfill;
    		if( !supportPicture && ( polyfill = (window.picturefill || lazySizesCfg.pf) ) ){
    			if(full && full.src && !el[_getAttribute]('srcset')){
    				el.setAttribute('srcset', full.src);
    			}
    			polyfill({reevaluate: true, elements: [el]});
    		} else if(full && full.src){
    			el.src = full.src;
    		}
    	};

    	var getCSS = function (elem, style){
    		return (getComputedStyle(elem, null) || {})[style];
    	};

    	/**
    	 *
    	 * @param elem { Element }
    	 * @param parent { Element }
    	 * @param [width] {number}
    	 * @returns {number}
    	 */
    	var getWidth = function(elem, parent, width){
    		width = width || elem.offsetWidth;

    		while(width < lazySizesCfg.minSize && parent && !elem._lazysizesWidth){
    			width =  parent.offsetWidth;
    			parent = parent.parentNode;
    		}

    		return width;
    	};

    	var rAF = (function(){
    		var running, waiting;
    		var firstFns = [];
    		var secondFns = [];
    		var fns = firstFns;

    		var run = function(){
    			var runFns = fns;

    			fns = firstFns.length ? secondFns : firstFns;

    			running = true;
    			waiting = false;

    			while(runFns.length){
    				runFns.shift()();
    			}

    			running = false;
    		};

    		var rafBatch = function(fn, queue){
    			if(running && !queue){
    				fn.apply(this, arguments);
    			} else {
    				fns.push(fn);

    				if(!waiting){
    					waiting = true;
    					(document.hidden ? setTimeout : requestAnimationFrame)(run);
    				}
    			}
    		};

    		rafBatch._lsFlush = run;

    		return rafBatch;
    	})();

    	var rAFIt = function(fn, simple){
    		return simple ?
    			function() {
    				rAF(fn);
    			} :
    			function(){
    				var that = this;
    				var args = arguments;
    				rAF(function(){
    					fn.apply(that, args);
    				});
    			}
    		;
    	};

    	var throttle = function(fn){
    		var running;
    		var lastTime = 0;
    		var gDelay = lazySizesCfg.throttleDelay;
    		var rICTimeout = lazySizesCfg.ricTimeout;
    		var run = function(){
    			running = false;
    			lastTime = Date.now();
    			fn();
    		};
    		var idleCallback = requestIdleCallback && rICTimeout > 49 ?
    			function(){
    				requestIdleCallback(run, {timeout: rICTimeout});

    				if(rICTimeout !== lazySizesCfg.ricTimeout){
    					rICTimeout = lazySizesCfg.ricTimeout;
    				}
    			} :
    			rAFIt(function(){
    				setTimeout(run);
    			}, true)
    		;

    		return function(isPriority){
    			var delay;

    			if((isPriority = isPriority === true)){
    				rICTimeout = 33;
    			}

    			if(running){
    				return;
    			}

    			running =  true;

    			delay = gDelay - (Date.now() - lastTime);

    			if(delay < 0){
    				delay = 0;
    			}

    			if(isPriority || delay < 9){
    				idleCallback();
    			} else {
    				setTimeout(idleCallback, delay);
    			}
    		};
    	};

    	//based on http://modernjavascript.blogspot.de/2013/08/building-better-debounce.html
    	var debounce = function(func) {
    		var timeout, timestamp;
    		var wait = 99;
    		var run = function(){
    			timeout = null;
    			func();
    		};
    		var later = function() {
    			var last = Date.now() - timestamp;

    			if (last < wait) {
    				setTimeout(later, wait - last);
    			} else {
    				(requestIdleCallback || run)(run);
    			}
    		};

    		return function() {
    			timestamp = Date.now();

    			if (!timeout) {
    				timeout = setTimeout(later, wait);
    			}
    		};
    	};

    	var loader = (function(){
    		var preloadElems, isCompleted, resetPreloadingTimer, loadMode, started;

    		var eLvW, elvH, eLtop, eLleft, eLright, eLbottom, isBodyHidden;

    		var regImg = /^img$/i;
    		var regIframe = /^iframe$/i;

    		var supportScroll = ('onscroll' in window) && !(/(gle|ing)bot/.test(navigator.userAgent));

    		var shrinkExpand = 0;
    		var currentExpand = 0;

    		var isLoading = 0;
    		var lowRuns = -1;

    		var resetPreloading = function(e){
    			isLoading--;
    			if(!e || isLoading < 0 || !e.target){
    				isLoading = 0;
    			}
    		};

    		var isVisible = function (elem) {
    			if (isBodyHidden == null) {
    				isBodyHidden = getCSS(document.body, 'visibility') == 'hidden';
    			}

    			return isBodyHidden || !(getCSS(elem.parentNode, 'visibility') == 'hidden' && getCSS(elem, 'visibility') == 'hidden');
    		};

    		var isNestedVisible = function(elem, elemExpand){
    			var outerRect;
    			var parent = elem;
    			var visible = isVisible(elem);

    			eLtop -= elemExpand;
    			eLbottom += elemExpand;
    			eLleft -= elemExpand;
    			eLright += elemExpand;

    			while(visible && (parent = parent.offsetParent) && parent != document.body && parent != docElem){
    				visible = ((getCSS(parent, 'opacity') || 1) > 0);

    				if(visible && getCSS(parent, 'overflow') != 'visible'){
    					outerRect = parent.getBoundingClientRect();
    					visible = eLright > outerRect.left &&
    						eLleft < outerRect.right &&
    						eLbottom > outerRect.top - 1 &&
    						eLtop < outerRect.bottom + 1
    					;
    				}
    			}

    			return visible;
    		};

    		var checkElements = function() {
    			var eLlen, i, rect, autoLoadElem, loadedSomething, elemExpand, elemNegativeExpand, elemExpandVal,
    				beforeExpandVal, defaultExpand, preloadExpand, hFac;
    			var lazyloadElems = lazysizes.elements;

    			if((loadMode = lazySizesCfg.loadMode) && isLoading < 8 && (eLlen = lazyloadElems.length)){

    				i = 0;

    				lowRuns++;

    				for(; i < eLlen; i++){

    					if(!lazyloadElems[i] || lazyloadElems[i]._lazyRace){continue;}

    					if(!supportScroll || (lazysizes.prematureUnveil && lazysizes.prematureUnveil(lazyloadElems[i]))){unveilElement(lazyloadElems[i]);continue;}

    					if(!(elemExpandVal = lazyloadElems[i][_getAttribute]('data-expand')) || !(elemExpand = elemExpandVal * 1)){
    						elemExpand = currentExpand;
    					}

    					if (!defaultExpand) {
    						defaultExpand = (!lazySizesCfg.expand || lazySizesCfg.expand < 1) ?
    							docElem.clientHeight > 500 && docElem.clientWidth > 500 ? 500 : 370 :
    							lazySizesCfg.expand;

    						lazysizes._defEx = defaultExpand;

    						preloadExpand = defaultExpand * lazySizesCfg.expFactor;
    						hFac = lazySizesCfg.hFac;
    						isBodyHidden = null;

    						if(currentExpand < preloadExpand && isLoading < 1 && lowRuns > 2 && loadMode > 2 && !document.hidden){
    							currentExpand = preloadExpand;
    							lowRuns = 0;
    						} else if(loadMode > 1 && lowRuns > 1 && isLoading < 6){
    							currentExpand = defaultExpand;
    						} else {
    							currentExpand = shrinkExpand;
    						}
    					}

    					if(beforeExpandVal !== elemExpand){
    						eLvW = innerWidth + (elemExpand * hFac);
    						elvH = innerHeight + elemExpand;
    						elemNegativeExpand = elemExpand * -1;
    						beforeExpandVal = elemExpand;
    					}

    					rect = lazyloadElems[i].getBoundingClientRect();

    					if ((eLbottom = rect.bottom) >= elemNegativeExpand &&
    						(eLtop = rect.top) <= elvH &&
    						(eLright = rect.right) >= elemNegativeExpand * hFac &&
    						(eLleft = rect.left) <= eLvW &&
    						(eLbottom || eLright || eLleft || eLtop) &&
    						(lazySizesCfg.loadHidden || isVisible(lazyloadElems[i])) &&
    						((isCompleted && isLoading < 3 && !elemExpandVal && (loadMode < 3 || lowRuns < 4)) || isNestedVisible(lazyloadElems[i], elemExpand))){
    						unveilElement(lazyloadElems[i]);
    						loadedSomething = true;
    						if(isLoading > 9){break;}
    					} else if(!loadedSomething && isCompleted && !autoLoadElem &&
    						isLoading < 4 && lowRuns < 4 && loadMode > 2 &&
    						(preloadElems[0] || lazySizesCfg.preloadAfterLoad) &&
    						(preloadElems[0] || (!elemExpandVal && ((eLbottom || eLright || eLleft || eLtop) || lazyloadElems[i][_getAttribute](lazySizesCfg.sizesAttr) != 'auto')))){
    						autoLoadElem = preloadElems[0] || lazyloadElems[i];
    					}
    				}

    				if(autoLoadElem && !loadedSomething){
    					unveilElement(autoLoadElem);
    				}
    			}
    		};

    		var throttledCheckElements = throttle(checkElements);

    		var switchLoadingClass = function(e){
    			var elem = e.target;

    			if (elem._lazyCache) {
    				delete elem._lazyCache;
    				return;
    			}

    			resetPreloading(e);
    			addClass(elem, lazySizesCfg.loadedClass);
    			removeClass(elem, lazySizesCfg.loadingClass);
    			addRemoveLoadEvents(elem, rafSwitchLoadingClass);
    			triggerEvent(elem, 'lazyloaded');
    		};
    		var rafedSwitchLoadingClass = rAFIt(switchLoadingClass);
    		var rafSwitchLoadingClass = function(e){
    			rafedSwitchLoadingClass({target: e.target});
    		};

    		var changeIframeSrc = function(elem, src){
    			var loadMode = elem.getAttribute('data-load-mode') || lazySizesCfg.iframeLoadMode;

    			// loadMode can be also a string!
    			if (loadMode == 0) {
    				elem.contentWindow.location.replace(src);
    			} else if (loadMode == 1) {
    				elem.src = src;
    			}
    		};

    		var handleSources = function(source){
    			var customMedia;

    			var sourceSrcset = source[_getAttribute](lazySizesCfg.srcsetAttr);

    			if( (customMedia = lazySizesCfg.customMedia[source[_getAttribute]('data-media') || source[_getAttribute]('media')]) ){
    				source.setAttribute('media', customMedia);
    			}

    			if(sourceSrcset){
    				source.setAttribute('srcset', sourceSrcset);
    			}
    		};

    		var lazyUnveil = rAFIt(function (elem, detail, isAuto, sizes, isImg){
    			var src, srcset, parent, isPicture, event, firesLoad;

    			if(!(event = triggerEvent(elem, 'lazybeforeunveil', detail)).defaultPrevented){

    				if(sizes){
    					if(isAuto){
    						addClass(elem, lazySizesCfg.autosizesClass);
    					} else {
    						elem.setAttribute('sizes', sizes);
    					}
    				}

    				srcset = elem[_getAttribute](lazySizesCfg.srcsetAttr);
    				src = elem[_getAttribute](lazySizesCfg.srcAttr);

    				if(isImg) {
    					parent = elem.parentNode;
    					isPicture = parent && regPicture.test(parent.nodeName || '');
    				}

    				firesLoad = detail.firesLoad || (('src' in elem) && (srcset || src || isPicture));

    				event = {target: elem};

    				addClass(elem, lazySizesCfg.loadingClass);

    				if(firesLoad){
    					clearTimeout(resetPreloadingTimer);
    					resetPreloadingTimer = setTimeout(resetPreloading, 2500);
    					addRemoveLoadEvents(elem, rafSwitchLoadingClass, true);
    				}

    				if(isPicture){
    					forEach.call(parent.getElementsByTagName('source'), handleSources);
    				}

    				if(srcset){
    					elem.setAttribute('srcset', srcset);
    				} else if(src && !isPicture){
    					if(regIframe.test(elem.nodeName)){
    						changeIframeSrc(elem, src);
    					} else {
    						elem.src = src;
    					}
    				}

    				if(isImg && (srcset || isPicture)){
    					updatePolyfill(elem, {src: src});
    				}
    			}

    			if(elem._lazyRace){
    				delete elem._lazyRace;
    			}
    			removeClass(elem, lazySizesCfg.lazyClass);

    			rAF(function(){
    				// Part of this can be removed as soon as this fix is older: https://bugs.chromium.org/p/chromium/issues/detail?id=7731 (2015)
    				var isLoaded = elem.complete && elem.naturalWidth > 1;

    				if( !firesLoad || isLoaded){
    					if (isLoaded) {
    						addClass(elem, lazySizesCfg.fastLoadedClass);
    					}
    					switchLoadingClass(event);
    					elem._lazyCache = true;
    					setTimeout(function(){
    						if ('_lazyCache' in elem) {
    							delete elem._lazyCache;
    						}
    					}, 9);
    				}
    				if (elem.loading == 'lazy') {
    					isLoading--;
    				}
    			}, true);
    		});

    		/**
    		 *
    		 * @param elem { Element }
    		 */
    		var unveilElement = function (elem){
    			if (elem._lazyRace) {return;}
    			var detail;

    			var isImg = regImg.test(elem.nodeName);

    			//allow using sizes="auto", but don't use. it's invalid. Use data-sizes="auto" or a valid value for sizes instead (i.e.: sizes="80vw")
    			var sizes = isImg && (elem[_getAttribute](lazySizesCfg.sizesAttr) || elem[_getAttribute]('sizes'));
    			var isAuto = sizes == 'auto';

    			if( (isAuto || !isCompleted) && isImg && (elem[_getAttribute]('src') || elem.srcset) && !elem.complete && !hasClass(elem, lazySizesCfg.errorClass) && hasClass(elem, lazySizesCfg.lazyClass)){return;}

    			detail = triggerEvent(elem, 'lazyunveilread').detail;

    			if(isAuto){
    				 autoSizer.updateElem(elem, true, elem.offsetWidth);
    			}

    			elem._lazyRace = true;
    			isLoading++;

    			lazyUnveil(elem, detail, isAuto, sizes, isImg);
    		};

    		var afterScroll = debounce(function(){
    			lazySizesCfg.loadMode = 3;
    			throttledCheckElements();
    		});

    		var altLoadmodeScrollListner = function(){
    			if(lazySizesCfg.loadMode == 3){
    				lazySizesCfg.loadMode = 2;
    			}
    			afterScroll();
    		};

    		var onload = function(){
    			if(isCompleted){return;}
    			if(Date.now() - started < 999){
    				setTimeout(onload, 999);
    				return;
    			}


    			isCompleted = true;

    			lazySizesCfg.loadMode = 3;

    			throttledCheckElements();

    			addEventListener('scroll', altLoadmodeScrollListner, true);
    		};

    		return {
    			_: function(){
    				started = Date.now();

    				lazysizes.elements = document.getElementsByClassName(lazySizesCfg.lazyClass);
    				preloadElems = document.getElementsByClassName(lazySizesCfg.lazyClass + ' ' + lazySizesCfg.preloadClass);

    				addEventListener('scroll', throttledCheckElements, true);

    				addEventListener('resize', throttledCheckElements, true);

    				addEventListener('pageshow', function (e) {
    					if (e.persisted) {
    						var loadingElements = document.querySelectorAll('.' + lazySizesCfg.loadingClass);

    						if (loadingElements.length && loadingElements.forEach) {
    							requestAnimationFrame(function () {
    								loadingElements.forEach( function (img) {
    									if (img.complete) {
    										unveilElement(img);
    									}
    								});
    							});
    						}
    					}
    				});

    				if(window.MutationObserver){
    					new MutationObserver( throttledCheckElements ).observe( docElem, {childList: true, subtree: true, attributes: true} );
    				} else {
    					docElem[_addEventListener]('DOMNodeInserted', throttledCheckElements, true);
    					docElem[_addEventListener]('DOMAttrModified', throttledCheckElements, true);
    					setInterval(throttledCheckElements, 999);
    				}

    				addEventListener('hashchange', throttledCheckElements, true);

    				//, 'fullscreenchange'
    				['focus', 'mouseover', 'click', 'load', 'transitionend', 'animationend'].forEach(function(name){
    					document[_addEventListener](name, throttledCheckElements, true);
    				});

    				if((/d$|^c/.test(document.readyState))){
    					onload();
    				} else {
    					addEventListener('load', onload);
    					document[_addEventListener]('DOMContentLoaded', throttledCheckElements);
    					setTimeout(onload, 20000);
    				}

    				if(lazysizes.elements.length){
    					checkElements();
    					rAF._lsFlush();
    				} else {
    					throttledCheckElements();
    				}
    			},
    			checkElems: throttledCheckElements,
    			unveil: unveilElement,
    			_aLSL: altLoadmodeScrollListner,
    		};
    	})();


    	var autoSizer = (function(){
    		var autosizesElems;

    		var sizeElement = rAFIt(function(elem, parent, event, width){
    			var sources, i, len;
    			elem._lazysizesWidth = width;
    			width += 'px';

    			elem.setAttribute('sizes', width);

    			if(regPicture.test(parent.nodeName || '')){
    				sources = parent.getElementsByTagName('source');
    				for(i = 0, len = sources.length; i < len; i++){
    					sources[i].setAttribute('sizes', width);
    				}
    			}

    			if(!event.detail.dataAttr){
    				updatePolyfill(elem, event.detail);
    			}
    		});
    		/**
    		 *
    		 * @param elem {Element}
    		 * @param dataAttr
    		 * @param [width] { number }
    		 */
    		var getSizeElement = function (elem, dataAttr, width){
    			var event;
    			var parent = elem.parentNode;

    			if(parent){
    				width = getWidth(elem, parent, width);
    				event = triggerEvent(elem, 'lazybeforesizes', {width: width, dataAttr: !!dataAttr});

    				if(!event.defaultPrevented){
    					width = event.detail.width;

    					if(width && width !== elem._lazysizesWidth){
    						sizeElement(elem, parent, event, width);
    					}
    				}
    			}
    		};

    		var updateElementsSizes = function(){
    			var i;
    			var len = autosizesElems.length;
    			if(len){
    				i = 0;

    				for(; i < len; i++){
    					getSizeElement(autosizesElems[i]);
    				}
    			}
    		};

    		var debouncedUpdateElementsSizes = debounce(updateElementsSizes);

    		return {
    			_: function(){
    				autosizesElems = document.getElementsByClassName(lazySizesCfg.autosizesClass);
    				addEventListener('resize', debouncedUpdateElementsSizes);
    			},
    			checkElems: debouncedUpdateElementsSizes,
    			updateElem: getSizeElement
    		};
    	})();

    	var init = function(){
    		if(!init.i && document.getElementsByClassName){
    			init.i = true;
    			autoSizer._();
    			loader._();
    		}
    	};

    	setTimeout(function(){
    		if(lazySizesCfg.init){
    			init();
    		}
    	});

    	lazysizes = {
    		/**
    		 * @type { LazySizesConfigPartial }
    		 */
    		cfg: lazySizesCfg,
    		autoSizer: autoSizer,
    		loader: loader,
    		init: init,
    		uP: updatePolyfill,
    		aC: addClass,
    		rC: removeClass,
    		hC: hasClass,
    		fire: triggerEvent,
    		gW: getWidth,
    		rAF: rAF,
    	};

    	return lazysizes;
    }
    ));
    });

    lazysizes.init();

    const app = new App({
    	target: document.body
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
