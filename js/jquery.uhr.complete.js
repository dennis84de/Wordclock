/*! uhr - v8.0.4-dev.0 - 2016-06-27
* http://bärneruhr.ch/
* Copyright (c) 2016 Manuel Friedli; Licensed GPL-3.0 */
(function($) {
    'use strict';
    var uhrGlobals = {
        "id": 0,
        "languages": [],
        "themes": [],
        registerLanguage: function registerLanguage(code, language) {
            var alreadyExists = uhrGlobals.languages.some(function(element) {
                if (code === element.code) {
                    console.error("Error: Language code '" + code + "' cannot be registered for language '" + language.language +
                                  "' because it is already registered for language '" + element.language + "'!");
                    return true;
                }
                return false;
            });
            if (!alreadyExists) {
                language.code = code;
                uhrGlobals.languages.push(language);
            }
        }
    };

    // auto-detect themes
    $('link[rel=stylesheet]').each(function(index, item) {
        var styleSheet = $(item);
        var styleClass = styleSheet.attr('data-class');
        if (styleClass !== undefined) {
            var name = styleSheet.attr('data-name');
            if (name === undefined) {
                name = styleClass;
            }
            uhrGlobals.themes.push({'styleClass': styleClass, 'name': name});
        }
    });
    // fall-back if no theme was included
    if (uhrGlobals.themes.length === 0) {
        uhrGlobals.themes.push({});
    }

    // public interface methods (exported later)
    var start = function start() {
        if (!isOn.bind(this)()) {
            this.timer = window.setInterval(function() {
                this.options.time = new Date();
                update.bind(this)();
            }.bind(this), 1000);
            update.bind(this)();
            setCookie.bind(this)('uhr-status', 'on');
        }
    };
    var stop = function stop() {
        if (isOn.bind(this)()) {
            window.clearInterval(this.timer);
            this.timer = null;
            update.bind(this)();
            setCookie.bind(this)('uhr-status', 'off');
        }
    };
    var toggle = function toggle() {
        if (isOn.bind(this)()) {
            this.stop();
        } else {
            this.start();
        }
    };
    var setLanguage = function setLanguage(languageKey) {
        if (languageKey !== this.options.language) {
            this.options.language = languageKey;
            var renderer = new UhrRenderer(language.bind(this)(), this.element.find('.letterarea'));
            renderer.render.bind(this)(function() {
                this.currentMinute = -1;
                update.bind(this)();
            }.bind(this));
            setCookie.bind(this)('uhr-language', languageKey);
            update.bind(this)();
        }
    };
    var setTheme = function setTheme(theme) {
        if (theme !== this.options.theme) {
            this.element.removeClass(this.options.theme).addClass(theme);
            $('#uhr-onoffswitch' + this.id).removeClass(this.options.theme).addClass(theme);
            this.options.theme = theme;
            setCookie.bind(this)('uhr-theme', theme);
        }
    };
    var setTime = function setTime(time) {
        this.currentMinute = -1;
        if (time === null) {
            this.options.time = new Date();
        } else {
            if (this.timer !== null) {
                window.clearInterval(this.timer);
            }
            this.options.time = time;
        }
        update.bind(this)();
    };
    var setMode = function(mode) {
        this.options.mode = mode;
        this.currentMinute = -1;
        update.bind(this)();
        setCookie.bind(this)('uhr-mode', mode);
    };
    var setWidth = function setWidth(width) {
        var e = this.element;
        e.css('width', width);
        var realWidth = e.width();
        e.width(realWidth);
        e.height(realWidth);
        e.css('font-size', (realWidth / 40) + 'px');
    };

    // private interface methods
    var create = function create() {
        this.id = uhrGlobals.id++;
        this.timer = null;
        this.currentMinute = -1;
        var userTime = this.options.time;
        var hash, params;
        if (this.options.time === undefined) {
            this.options.time = new Date();
        }
        // parse the URL params
        hash = window.location.hash;
        if (hash !== undefined && typeof hash === 'string' && hash.charAt(0) === '#') {
            hash = hash.substring(1);
            hash = decodeURIComponent(hash);
            params = hash.split('&');
            params.forEach(function (element) {
                var pair = element.split('=');
                var key = pair[0];
                var value = pair[1];
                switch (key) {
                    case 'l':
                    case 'language':
                        this.options.language = value;
                        this.options.force = true;
                        break;
                    case 't':
                    case 'theme':
                        this.options.theme = value;
                        this.options.force = true;
                        break;
                    case 'm':
                    case 'mode':
                        this.options.mode = value;
                        this.options.force = true;
                        break;
                    case 's':
                    case 'status':
                        this.options.status = value;
                        this.options.force = true;
                        break;
                }
            }.bind(this));
        }
        // end parse the URL params
        setupHTML.bind(this)();
        wireFunctionality.bind(this)();
        if (userTime !== undefined) {
            this.time(userTime);
        }
    };
    // private helper methods (not exported)
    var toggleConfigScreen = function toggleConfigScreen() {
        $('#uhr-controlpanel' + this.id).toggle('fast');
    };
    // set up
    var setupHTML = function setupHTML() {
        var e = this.element;
        // Base clock area
        e.addClass('uhr');
        e.empty();
        e.append('<span class="item dot dot1"></span>');
        e.append('<span class="item dot dot2"></span>');
        e.append('<span class="item dot dot3"></span>');
        e.append('<span class="item dot dot4"></span>');
        e.append('<div class="letterarea"></div>');
        e.append('<div class="reflection"></div>');
        setWidth.bind(this)(this.options.width);

        if (this.options.controls) {
            var controlpanel = $('<div class="uhr-controlpanel" id="uhr-controlpanel' + this.id + '"></div>');
            var content = $('<div class="content"></div>');
            controlpanel.append(content);
            // on/off switch
            var toggleSwitch = $('<div class="onoffswitch" id="uhr-onoffswitch' + this.id + '"></div>');
            toggleSwitch.append('<input type="checkbox" class="onoffswitch-checkbox" id="uhr-onoffswitch-checkbox' + this.id +
                                '" checked="checked" />');
            toggleSwitch.append('<label class="onoffswitch-label" for="uhr-onoffswitch-checkbox' + this.id + '">' +
                                '<div class="onoffswitch-inner"></div>' + '<div class="onoffswitch-switch"></div>' + '</label>');
            content.append(toggleSwitch);

            // time mode switch
            var modeSwitch = $('<div class="onoffswitch" id="uhr-modeswitch' + this.id + '"></div>');
            modeSwitch.append('<input type="checkbox" class="onoffswitch-checkbox" id="uhr-modeswitch-checkbox' + this.id +
                                '" checked="checked" />');
            modeSwitch.append('<label class="onoffswitch-label" for="uhr-modeswitch-checkbox' + this.id + '">' +
                                '<div class="modeswitch-inner"></div>' + '<div class="onoffswitch-switch"></div>' +
                                '</label>');
            content.append(modeSwitch);
            // language chooser
            if (uhrGlobals.languages.length > 1) {
                var languageChooser = $('<select id="uhr-languagechooser' + this.id + '"></select>');
                uhrGlobals.languages.forEach(function(item) {
                    languageChooser.append('<option value="' + item.code + '">' + item.language + '</option>');
                });
                content.append(languageChooser);
            }

            // theme chooser
            if (uhrGlobals.themes.length > 1) {
                var themeChooser = $('<select id="uhr-themechooser' + this.id + '"></select>');
                uhrGlobals.themes.forEach(function(item) {
                    themeChooser.append('<option value="' + item.styleClass + '">' + item.name + '</option>');
                });
                content.append(themeChooser);
            }
            var closebutton = $('<a class="uhr-closecontrolpanel" id="uhr-closecontrolpanel' + this.id + '"></a>');
            closebutton.on('click', function() {
                $('#uhr-controlpanel' + this.id).hide('fast');
            }.bind(this));
            content.append(closebutton);
            e.after(controlpanel);
            controlpanel.hide();
            var configlink = $('<a class="uhr-configlink" id="uhr-configlink' + this.id + '"></a>');
            configlink.on('click', function() {
                toggleConfigScreen.bind(this)();
            }.bind(this));
            e.after(configlink);
        }
    };
    var wireFunctionality = function wireFunctionality() {
        // on/off switch
        var toggleSwitch = $('#uhr-onoffswitch-checkbox' + this.id);
        toggleSwitch.on('click', function() {
            this.toggle();
        }.bind(this));
        var status = $.cookie('uhr-status' + this.id);
        if (status === undefined || this.options.force) {
            status = this.options.status;
        }
        toggleSwitch.prop('checked', status === 'on');
        if (status === 'on') {
            this.start();
        } else {
            this.stop();
        }

        // time mode switch
        var modeSwitch = $('#uhr-modeswitch-checkbox' + this.id);
        modeSwitch.on('click', function() {
            if (this.options.mode === 'seconds') {
                setMode.bind(this)('normal');
            } else {
                setMode.bind(this)('seconds');
            }
        }.bind(this));

        var mode = $.cookie('uhr-mode' + this.id);
        if (mode === undefined || this.options.force) {
            mode = this.options.mode;
        }
        modeSwitch.prop('checked', mode !== 'seconds');
        if (mode === 'seconds') {
            setMode.bind(this)('seconds');
        } else {
            setMode.bind(this)('normal');
        }

        // language chooser
        var languageChooser = $('#uhr-languagechooser' + this.id);
        languageChooser.on('change', function() {
            var languageKey = $('#uhr-languagechooser' + this.id).val();
            this.language(languageKey);
        }.bind(this));
        var selectedLanguage = $.cookie('uhr-language' + this.id);
        if (selectedLanguage === undefined || this.options.force) {
            selectedLanguage = this.options.language;
        }
        var found = uhrGlobals.languages.some(function(item) {
            return selectedLanguage === item.code;
        });
        if (!found) {
            var fallbackLanguage;
            if (uhrGlobals.languages.length > 0) {
                fallbackLanguage = uhrGlobals.languages[0].code;
            } else {
                fallbackLanguage = '';
            }
            console.warn("Language '" + selectedLanguage + "' not found! Using fallback '" + fallbackLanguage + "'");
            selectedLanguage = fallbackLanguage;
        }
        languageChooser.val(selectedLanguage);
        this.options.language = "";
        this.language(selectedLanguage);

        // theme chooser
        var themeChooser = $('#uhr-themechooser' + this.id);
        themeChooser.on('change', function() {
            var themeKey = $('#uhr-themechooser' + this.id).val();
            this.theme(themeKey);
        }.bind(this));
        var selectedTheme = $.cookie('uhr-theme' + this.id);
        if (selectedTheme === undefined || this.options.force) {
            selectedTheme = this.options.theme;
        }
        found = uhrGlobals.themes.some(function(item) {
            return selectedTheme === item.styleClass;
        });
        if (!found) {
            var fallbackTheme = uhrGlobals.themes[0].styleClass;
            console.warn("Theme '" + selectedTheme + "' not found! Using fallback '" + fallbackTheme + "'");
            selectedTheme = fallbackTheme;
        }
        themeChooser.val(selectedTheme);
        this.options.theme = "";
        this.theme(selectedTheme);
        if (this.options.autoresize) {
            $(window).on('resize', function() {
                var $e = this.element;
                var $parent = $e.parent();
                var $window = $(window);
                var parentWidth = $parent.width();
                var parentHeight = $parent.height();
                var windowWidth = $window.width();
                var windowHeight = $window.height();
                var size = Math.min(parentWidth, parentHeight, windowWidth, windowHeight) + 'px';
                setWidth.bind(this)(size);
            }.bind(this));
        }
    };
    var destroy = function destroy() {
        this.timer = null;
        $(this.element)
            .removeAttr('style')
            .removeAttr('class')
            .empty();
        $('#uhr-configlink' + this.id).remove();
        $('#uhr-controlpanel' + this.id).remove();

    };
    var setCookie = function setCookie(cookieName, cookieValue) {
        var options = {};
        if (this.options.cookiePath !== undefined) {
            options = {expires: 365, path: this.options.cookiePath};
        } else {
            options = {expires: 365};
        }
        $.cookie(cookieName + this.id, cookieValue, options);
    };

    // business logic
    var isOn = function isOn() {
        return this.timer !== null;
    };
    var update = function update() {
        if (isOn.bind(this)()) {
            var time = this.options.time;
            if (!language.bind(this)().hasOwnProperty('seconds') && this.options.mode !== 'seconds') {
                if (time.getMinutes() === this.currentMinute) {
                    return;
                }
                this.currentMinute = time.getMinutes();
            }
            show.bind(this)(time);
        } else {
            clear.bind(this)();
            this.currentMinute = -1;
        }
    };
    var show = function show(time) {
        var second = getSecond.bind(this)(time);
        var dotMinute = getDotMinute.bind(this)(time);
        var hour = getHour.bind(this)(time);
        var coarseMinute = getCoarseMinute.bind(this)(time);
        clear.bind(this)();
        if (this.options.mode === 'seconds') {
            highlight.bind(this)('second' + second);
        } else {
            highlight.bind(this)('on');
            for (var i = 1; i <= dotMinute; i++) {
                highlight.bind(this)('dot' + i);
            }
            highlight.bind(this)('minute' + coarseMinute);
            highlight.bind(this)('hour' + hour);
        }
    };
    var highlight = function highlight(itemClass) {
        this.element.find('.item.' + itemClass).addClass('active');
    };
    var clear = function clear() {
        this.element.find('.item').removeClass('active');
    };
    var getSecond = function getSecond(date) {
        if (typeof language.bind(this)().getSeconds === 'function') {
            return language.bind(this)().getSeconds(date);
        }
        return date.getSeconds();
    };
    var getDotMinute = function getDotMinute(date) {
        if (typeof language.bind(this)().getDotMinute === 'function') {
            return language.bind(this)().getDotMinute(date);
        }
        var minutes = date.getMinutes();
        return minutes % 5;
    };
    var getCoarseMinute = function getCoarseMinute(date) {
        if (typeof language.bind(this)().getCoarseMinute === 'function') {
            return language.bind(this)().getCoarseMinute(date);
        }
        return date.getMinutes();
    };
    var getHour = function getHour(date) {
        if (typeof language.bind(this)().getHour === 'function') {
            return language.bind(this)().getHour(date);
        }
        var hour = date.getHours();
        if (date.getMinutes() >= 25) {
            return (hour + 1) % 24;
        }
        return hour;
    };
    var language = function language() {
        var matchingLanguages = uhrGlobals.languages.filter(function(element) {
            return (element.code === this.options.language);
        }, this);
        if (matchingLanguages.length > 0) {
            return matchingLanguages[0];
        }
        // fallback: return empty object
        return {};
    };

    $.widget("fritteli.uhr", {
        "options": {
            width: '100%',
            status: 'on',
            language: 'de_CH',
            theme: uhrGlobals.themes[0].styleClass,
            force: false,
            controls: true,
            cookiePath: undefined,
            autoresize: true,
            mode: 'normal'
        },
        "start": start,
        "stop": stop,
        "toggle": toggle,
        "language": setLanguage,
        "theme": setTheme,
        "time": setTime,
        "mode": setMode,
        "width": setWidth,
        // constructor method
        "_create": create,
        // destructor method
        "_destroy": destroy
    });
    $.fritteli.uhr.register = uhrGlobals.registerLanguage;
    /**
     * Hilfsklasse zum Rendern der Uhr.
     * @param layout     Layout-Objekt, das gerendert werden soll.
     * @param renderarea Das jQuery-gewrappte HTML-Element, auf dem gerendert werden soll.
     */
    function UhrRenderer(layout, renderarea) {
        this.render = function render(beforeshow) {
            if (layout.parsed === undefined) {
                switch (layout.version) {
                case 2:
                    var delegate = new UhrRendererV2Delegate(layout);
                    var parsedLayout = delegate.parse();
                    Object.defineProperty(layout, "parsed", {"value": parsedLayout, "writable": false, "configurable": false});
                    break;
                default:
                    console.warn("Unknown layout version: '" + layout.version + "'");
                    return;
                }
            }
            var letters = layout.parsed;
            renderarea.fadeOut('fast', function() {
                renderarea.empty();
                letters.forEach(function(line, index, array) {
                    line.forEach(function(letter) {
                        renderarea.append(letter.toString());
                    });
                    if (index < array.length - 1) {
                        renderarea.append('<br/>');
                    }
                });
                if (typeof beforeshow === 'function') {
                    beforeshow();
                }
                renderarea.fadeIn('fast');
            });
        };
    }

    function UhrRendererV2Delegate(layout) {
        var vorne0 = {
            3: [2, 3, 4],
            4: [1, 5],
            5: [1, 4, 5],
            6: [1, 3, 5],
            7: [1, 2, 5],
            8: [1, 5],
            9: [2, 3, 4]
        };
        var hinten0 = {
            3: [8, 9, 10],
            4: [7, 11],
            5: [7, 10, 11],
            6: [7, 9, 11],
            7: [7, 8, 11],
            8: [7, 11],
            9: [8, 9, 10]
        };
        var vorne1 = {
            3: [3],
            4: [2, 3],
            5: [3],
            6: [3],
            7: [3],
            8: [3],
            9: [2, 3, 4]
        };
        var hinten1 = {
            3: [9],
            4: [8, 9],
            5: [9],
            6: [9],
            7: [9],
            8: [9],
            9: [8, 9, 10]
        };
        var vorne2 = {
            3: [2, 3, 4],
            4: [1, 5],
            5: [5],
            6: [4],
            7: [3],
            8: [2],
            9: [1, 2, 3, 4, 5]
        };
        var hinten2 = {
            3: [8, 9, 10],
            4: [7, 11],
            5: [11],
            6: [10],
            7: [9],
            8: [8],
            9: [7, 8, 9, 10, 11]
        };
        var vorne3 = {
            3: [1, 2, 3, 4, 5],
            4: [4],
            5: [3],
            6: [4],
            7: [5],
            8: [1, 5],
            9: [2, 3, 4]
        };
        var hinten3 = {
            3: [7, 8, 9, 10, 11],
            4: [10],
            5: [9],
            6: [10],
            7: [11],
            8: [7, 11],
            9: [8, 9, 10]
        };
        var vorne4 = {
            3: [4],
            4: [3, 4],
            5: [2, 4],
            6: [1, 4],
            7: [1, 2, 3, 4, 5],
            8: [4],
            9: [4]
        };
        var hinten4 = {
            3: [10],
            4: [9, 10],
            5: [8, 10],
            6: [7, 10],
            7: [7, 8, 9, 10, 11],
            8: [10],
            9: [10]
        };
        var vorne5 = {
            3: [1, 2, 3, 4, 5],
            4: [1],
            5: [1, 2, 3, 4],
            6: [5],
            7: [5],
            8: [1, 5],
            9: [2, 3, 4]
        };
        var hinten5 = {
            3: [7, 8, 9, 10, 11],
            4: [7],
            5: [7, 8, 9, 10],
            6: [11],
            7: [11],
            8: [7, 11],
            9: [8, 9, 10]
        };
        var hinten6 = {
            3: [9, 10],
            4: [8],
            5: [7],
            6: [7, 8, 9, 10],
            7: [7, 11],
            8: [7, 11],
            9: [8, 9, 10]
        };
        var hinten7 = {
            3: [7, 8, 9, 10, 11],
            4: [11],
            5: [10],
            6: [9],
            7: [8],
            8: [8],
            9: [8]
        };
        var hinten8 = {
            3: [8, 9, 10],
            4: [7, 11],
            5: [7, 11],
            6: [8, 9, 10],
            7: [7, 11],
            8: [7, 11],
            9: [8, 9, 10]
        };
        var hinten9 = {
            3: [8, 9, 10],
            4: [7, 11],
            5: [7, 11],
            6: [8, 9, 10, 11],
            7: [11],
            8: [10],
            9: [8, 9]
        };
        var seconds= {
            "0": [vorne0, hinten0],
            "1": [vorne0, hinten1],
            "2": [vorne0, hinten2],
            "3": [vorne0, hinten3],
            "4": [vorne0, hinten4],
            "5": [vorne0, hinten5],
            "6": [vorne0, hinten6],
            "7": [vorne0, hinten7],
            "8": [vorne0, hinten8],
            "9": [vorne0, hinten9],
            "10": [vorne1, hinten0],
            "11": [vorne1, hinten1],
            "12": [vorne1, hinten2],
            "13": [vorne1, hinten3],
            "14": [vorne1, hinten4],
            "15": [vorne1, hinten5],
            "16": [vorne1, hinten6],
            "17": [vorne1, hinten7],
            "18": [vorne1, hinten8],
            "19": [vorne1, hinten9],
            "20": [vorne2, hinten0],
            "21": [vorne2, hinten1],
            "22": [vorne2, hinten2],
            "23": [vorne2, hinten3],
            "24": [vorne2, hinten4],
            "25": [vorne2, hinten5],
            "26": [vorne2, hinten6],
            "27": [vorne2, hinten7],
            "28": [vorne2, hinten8],
            "29": [vorne2, hinten9],
            "30": [vorne3, hinten0],
            "31": [vorne3, hinten1],
            "32": [vorne3, hinten2],
            "33": [vorne3, hinten3],
            "34": [vorne3, hinten4],
            "35": [vorne3, hinten5],
            "36": [vorne3, hinten6],
            "37": [vorne3, hinten7],
            "38": [vorne3, hinten8],
            "39": [vorne3, hinten9],
            "40": [vorne4, hinten0],
            "41": [vorne4, hinten1],
            "42": [vorne4, hinten2],
            "43": [vorne4, hinten3],
            "44": [vorne4, hinten4],
            "45": [vorne4, hinten5],
            "46": [vorne4, hinten6],
            "47": [vorne4, hinten7],
            "48": [vorne4, hinten8],
            "49": [vorne4, hinten9],
            "50": [vorne5, hinten0],
            "51": [vorne5, hinten1],
            "52": [vorne5, hinten2],
            "53": [vorne5, hinten3],
            "54": [vorne5, hinten4],
            "55": [vorne5, hinten5],
            "56": [vorne5, hinten6],
            "57": [vorne5, hinten7],
            "58": [vorne5, hinten8],
            "59": [vorne5, hinten9]
        };

        function parseArrayOrObject(letters, styleClass, input) {
            if (typeof input !== 'undefined' && input !== null) {
                if (Array.isArray(input)) {
                    input.forEach(function(item) {
                        parseObject(letters, styleClass, item);
                    });
                } else {
                    parseObject(letters, styleClass, input);
                }
            }
        }

        function parseObject(letters, styleClass, object) {
            if (typeof object !== 'undefined' && object !== null) {
                Object.keys(object).forEach(function(y) {
                    var highlightLetters = object[y];
                    highlightLetters.forEach(function(x) {
                        letters[y - 1][x - 1].addStyle(styleClass);
                    });
                });
            }
        }

        function parseTimeDefinition(letters, styleClass, definition) {
            if (typeof definition !== 'undefined' && definition !== null) {
                Object.keys(definition).forEach(function(listString) {
                    var array = listString.split(',');
                    var highlightLetters = definition[listString];
                    array.forEach(function(item) {
                        parseArrayOrObject(letters, styleClass + item, highlightLetters);
                    });
                });
            }
        }

        this.parse = function parse() {
            var letters = [];
            layout.letters.forEach(function(string) {
                var line = [];
                for (var c = 0; c < string.length; c++) {
                    var character = new Letter(string[c]);
                    line.push(character);
                }
                letters.push(line);
            });
            parseArrayOrObject(letters, 'on', layout.permanent);
            if (typeof layout.seconds !== 'undefined' && layout.seconds !== null) {
                parseTimeDefinition(letters, 'second', layout.seconds);
            } else {
                parseTimeDefinition(letters, 'second', seconds);
            }
            parseTimeDefinition(letters, 'minute', layout.minutes);
            parseTimeDefinition(letters, 'hour', layout.hours);
            return letters;
        };
    }

    /**
     * Ein Buchstabe. Hilfsklasse für den Renderer und Inhalt der Layout-Arrays.
     * @param value Der Buchstabe, der Dargestellt werden soll.
     * @param style Die CSS-Styleklassen des Buchstabens.
     */
    function Letter(value, style) {
        var myValue = value;
        var myStyle = style || '';
        this.addStyle = function(style) {
            if (myStyle === '') {
                myStyle = style;
            } else {
                myStyle += ' ' + style;
            }
        };
        this.toString = function() {
            return '<span class="item letter ' + myStyle + '">' + myValue + '</span>';
        };
    }
})(jQuery);

(function($) {
    'use strict';
    var es_ist = {1: [1, 2, 4, 5, 6]};
    var uhr = {10: [9, 10, 11]};
    var nach = {4: [8, 9, 10, 11]};
    var vor = {4: [1, 2, 3]};
    var halb = {5: [1, 2, 3, 4]};
    var fuenf = {1: [8, 9, 10, 11]};
    var zehn = {2: [1, 2, 3, 4]};
    var viertel = {3: [5, 6, 7, 8, 9, 10, 11]};
    var zwanzig = {2: [5, 6, 7, 8, 9, 10, 11]};
    var dreiviertel = {3: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]};

    var layout = {
        "version": 2,
        "language": 'Deutsch',
        "letters": [
            'ESKISTAFÜNF',
            'ZEHNZWANZIG',
            'DREIVIERTEL',
            'VORFUNKNACH',
            'HALBAELFÜNF',
            'EINSXAMZWEI',
            'DREIPMJVIER',
            'SECHSNLACHT',
            'SIEBENZWÖLF',
            'ZEHNEUNKUHR'
        ],
        "permanent": es_ist,
        "minutes": {
            "0,1,2,3,4": uhr,
            "5,6,7,8,9": [fuenf, nach],
            "10,11,12,13,14": [zehn, nach],
            "15,16,17,18,19": [viertel, nach],
            "20,21,22,23,24": [zwanzig, nach],
            "25,26,27,28,29": [fuenf, vor, halb],
            "30,31,32,33,34": halb,
            "35,36,37,38,39": [fuenf, nach, halb],
            "40,41,42,43,44": [zwanzig, vor],
            "45,46,47,48,49": dreiviertel,
            "50,51,52,53,54": [zehn, vor],
            "55,56,57,58,59": [fuenf, vor]
        },
        "hours": {
            "0,12": {9: [7, 8, 9, 10, 11]},
            "1,13": {6: [1, 2, 3, 4]},
            "2,14": {6: [8, 9, 10, 11]},
            "3,15": {7: [1, 2, 3, 4]},
            "4,16": {7: [8, 9, 10, 11]},
            "5,17": {5: [8, 9, 10, 11]},
            "6,18": {8: [1, 2, 3, 4, 5]},
            "7,19": {9: [1, 2, 3, 4, 5, 6]},
            "8,20": {8: [8, 9, 10, 11]},
            "9,21": {10: [4, 5, 6, 7]},
            "10,22": {10: [1, 2, 3, 4]},
            "11,23": {5: [6, 7, 8]}
        }
    };
    $.fritteli.uhr.register('de', layout);
}(jQuery));
(function($) {
    'use strict';
// hilfsvariablen
    var es_isch = {1: [1, 2, 4, 5, 6, 7]};
    var ab = {4: [1, 2]};
    var vor = {3: [9, 10, 11]};
    var haubi = {4: [4, 5, 6, 7, 8]};
    var fuef = {1: [9, 10, 11]};
    var zae = {2: [9, 10, 11]};
    var viertu = {2: [1, 2, 3, 4, 5, 6]};
    var zwaenzg = {3: [1, 2, 3, 4, 5, 6]};
    var layout = {
        // version: zur Zeit immer 2 (Pflichtattribut)
        "version": 2,
        // Sprechender Name der Sprache
        "language": 'Bärndütsch',
        // Buchstabenfeld als Array von Strings.
        "letters": [
            'ESKISCHAFÜF',
            'VIERTUBFZÄÄ',
            'ZWÄNZGSIVOR',
            'ABOHAUBIEGE',
            'EISZWÖISDRÜ',
            'VIERIFÜFIQT',
            'SÄCHSISIBNI',
            'ACHTINÜNIEL',
            'ZÄNIERBEUFI',
            'ZWÖUFINAUHR'
        ],
        // Permanent aktive Buchstaben. <array-or-object>, vgl. ausführliche Beschreibung bei "minutes".
        "permanent": es_isch,
        /*
         * Minuten: Objekt im folgenden Format:
         * {
         *     <minuten>: <array-or-object>,
         *     ...
         * }
         * <minuten>: String von Komma-separierten Minutenwerten, zu welchem die in <array-or-object> angegebenen Buchstaben aktiv sein sollen
         * <array-or-object> : [ <object>, ...] | <object>
         * <object>: { <zeile> : [ <spalte>, ... ] }
         * <zeile>: Die Zeile, in welcher die Buchstaben liegen; von oben gezählt, oben ist 1.
         * <spalte>: Die Spalte, in der ein einzelner Buchstabe liegt; von links gezählt, links ist 1.
         * Beispiel:
         * "minutes": {
         *     "0,1": {1: [6, 7, 9]},
         *     "5": [ {3: [1, 2]}, {4: [10, 11]} ]
         * }
         * Erklärung:
         * Bei Minuten 0 und 1 sind die Buchstaben 6, 7 und 9 der ersten Zeile aktiv.
         * Bei Minute 5 sind die Buchstaben 1 und 2 der Zeile 3 sowie die Buchstaben 10 und 11 der Zeile 4 aktiv.
         */
        "minutes": {
            "5,6,7,8,9": [fuef, ab],
            "10,11,12,13,14": [zae, ab],
            "15,16,17,18,19": [viertu, ab],
            "20,21,22,23,24": [zwaenzg, ab],
            "25,26,27,28,29": [fuef, vor, haubi],
            "30,31,32,33,34": haubi,
            "35,36,37,38,39": [fuef, ab, haubi],
            "40,41,42,43,44": [zwaenzg, vor],
            "45,46,47,48,49": [viertu, vor],
            "50,51,52,53,54": [zae, vor],
            "55,56,57,58,59": [fuef, vor]
        },
        // Die Stunden; gleiches Format wie bei den Minuten
        "hours": {
            "0,12": {10: [1, 2, 3, 4, 5, 6]},
            "1,13": {5: [1, 2, 3]},
            "2,14": {5: [4, 5, 6, 7]},
            "3,15": {5: [9, 10, 11]},
            "4,16": {6: [1, 2, 3, 4, 5]},
            "5,17": {6: [6, 7, 8, 9]},
            "6,18": {7: [1, 2, 3, 4, 5, 6]},
            "7,19": {7: [7, 8, 9, 10, 11]},
            "8,20": {8: [1, 2, 3, 4, 5]},
            "9,21": {8: [6, 7, 8, 9]},
            "10,22": {9: [1, 2, 3, 4]},
            "11,23": {9: [8, 9, 10, 11]}
        }
    };
// Das Layout bei der Uhr unter dem Code "de_CH" registrieren.
    $.fritteli.uhr.register('de_CH', layout);
}(jQuery));
(function($) {
    'use strict';
    var es_isch = {1: [1, 2, 4, 5, 6, 7]};
    var genau = {3: [7, 8, 9, 10, 11]};
    var ab = {4: [4, 5]};
    var vor = {4: [1, 2, 3]};
    var haubi = {4: [7, 8, 9, 10, 11]};
    var fuef = {1: [9, 10, 11]};
    var zae = {2: [9, 10, 11]};
    var viertu = {2: [1, 2, 3, 4, 5, 6]};
    var zwaenzg = {3: [1, 2, 3, 4, 5, 6]};
    var layout = {
        "version": 2,
        "language": 'Bärndütsch (genau)',
        "letters": [
            'ESKISCHAFÜF',
            'VIERTUBFZÄÄ',
            'ZWÄNZGGENAU',
            'VORABOHAUBI',
            'EISZWÖISDRÜ',
            'VIERIFÜFIQT',
            'SÄCHSISIBNI',
            'ACHTINÜNIEL',
            'ZÄNIERBEUFI',
            'ZWÖUFINAUHR'
        ],
        "permanent": es_isch,
        "minutes": {
            "0": genau,
            "5,6,7,8,9": [fuef, ab],
            "10,11,12,13,14": [zae, ab],
            "15,16,17,18,19": [viertu, ab],
            "20,21,22,23,24": [zwaenzg, ab],
            "25,26,27,28,29": [fuef, vor, haubi],
            "30,31,32,33,34": haubi,
            "35,36,37,38,39": [fuef, ab, haubi],
            "40,41,42,43,44": [zwaenzg, vor],
            "45,46,47,48,49": [viertu, vor],
            "50,51,52,53,54": [zae, vor],
            "55,56,57,58,59": [fuef, vor]
        },
        "hours": {
            "0,12": {10: [1, 2, 3, 4, 5, 6]},
            "1,13": {5: [1, 2, 3]},
            "2,14": {5: [4, 5, 6, 7]},
            "3,15": {5: [9, 10, 11]},
            "4,16": {6: [1, 2, 3, 4, 5]},
            "5,17": {6: [6, 7, 8, 9]},
            "6,18": {7: [1, 2, 3, 4, 5, 6]},
            "7,19": {7: [7, 8, 9, 10, 11]},
            "8,20": {8: [1, 2, 3, 4, 5]},
            "9,21": {8: [6, 7, 8, 9]},
            "10,22": {9: [1, 2, 3, 4]},
            "11,23": {9: [8, 9, 10, 11]}
        }
    };
    $.fritteli.uhr.register('de_CH_genau', layout);
}(jQuery));
/*
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
(function($) {
    'use strict';

    var klokken_er = {1: [1, 2, 3, 4, 5, 6, 7, 9, 10]};
    var minutter = {4: [4, 5, 6, 7, 8, 9, 10, 11]};
    var i = {5: [8]};
    var over = {5: [4, 5, 6, 7]};
    var fem = {2: [1, 2, 3]};
    var ti = {4: [1, 2]};
    var kvart = {3: [4, 5, 6, 7, 8]};
    var tyve = {2: [4, 5, 6, 7]};
    var halv = {6: [8, 9, 10, 11]};

    var layout = {
        "version": 2,
        "language": 'Dansk',
        "letters": [
            'KLOKKENVERO',
            'FEMTYVESKLA',
            'OJEKVARTVAT',
            'TIAMINUTTER',
            'VEMOVERILMF',
            'MONALISHALV',
            'ETTOTREFIRE',
            'FEMSEKSRSYV',
            'OTTERNIMETI',
            'ELLEVEATOLV'
        ],
        "permanent": klokken_er,
        "minutes": {
            "5,6,7,8,9": [fem, minutter, over],
            "10,11,12,13,14": [ti, minutter, over],
            "15,16,17,18,19": [kvart, over],
            "20,21,22,23,24": [tyve, minutter, over],
            "25,26,27,28,29": [fem, minutter, i, halv],
            "30,31,32,33,34": [halv],
            "35,36,37,38,39": [fem, minutter, over, halv],
            "40,41,42,43,44": [tyve, minutter, i],
            "45,46,47,48,49": [kvart, i],
            "50,51,52,53,54": [ti, minutter, i],
            "55,56,57,58,59": [fem, minutter, i]
        },
        "hours": {
            "0,12": {10: [8, 9, 10, 11]},
            "1,13": {7: [1, 2]},
            "2,14": {7: [3, 4]},
            "3,15": {7: [5, 6, 7]},
            "4,16": {7: [8, 9, 10, 11]},
            "5,17": {8: [1, 2, 3]},
            "6,18": {8: [4, 5, 6, 7]},
            "7,19": {8: [9, 10, 11]},
            "8,20": {9: [1, 2, 3, 4]},
            "9,21": {9: [6, 7]},
            "10,22": {9: [10, 11]},
            "11,23": {10: [1, 2, 3, 4, 5, 6]}
        },
        "getHour": function (date) {
            var hour = date.getHours();
            if (date.getMinutes() >= 25) {
                return (hour + 1) % 24;
            }
            return hour;
        }
    };
    $.fritteli.uhr.register('dk', layout);
}(jQuery));
(function($) {
    'use strict';
    var it_is = {1: [1, 2, 4, 5]};
    var half = {4: [1, 2, 3, 4]};
    var to = {4: [10, 11]};
    var past = {5: [1, 2, 3, 4]};
    var o_clock = {10: [5, 6, 7, 8, 9, 10, 11]};
    var five = {3: [7, 8, 9, 10]};
    var ten = {4: [6, 7, 8]};
    var a_quarter = {2: [1, 3, 4, 5, 6, 7, 8, 9]};
    var twenty = {3: [1, 2, 3, 4, 5, 6]};
    var twentyfive = {3: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]};

    var layout = {
        "version": 2,
        "language": 'English',
        "letters": [
            'ITLISBFAMPM',
            'ACQUARTERDC',
            'TWENTYFIVEX',
            'HALFBTENFTO',
            'PASTERUNINE',
            'ONESIXTHREE',
            'FOURFIVETWO',
            'EIGHTELEVEN',
            'SEVENTWELVE',
            'TENSO\'CLOCK'
        ],
        "permanent": it_is,
        "minutes": {
            "0,1,2,3,4": o_clock,
            "5,6,7,8,9": [five, past],
            "10,11,12,13,14": [ten, past],
            "15,16,17,18,19": [a_quarter, past],
            "20,21,22,23,24": [twenty, past],
            "25,26,27,28,29": [twentyfive, past],
            "30,31,32,33,34": [half, past],
            "35,36,37,38,39": [twentyfive, to],
            "40,41,42,43,44": [twenty, to],
            "45,46,47,48,49": [a_quarter, to],
            "50,51,52,53,54": [ten, to],
            "55,56,57,58,59": [five, to]
        },
        "hours": {
            "0,12": {9: [6, 7, 8, 9, 10, 11]},
            "1,13": {6: [1, 2, 3]},
            "2,14": {7: [9, 10, 11]},
            "3,15": {6: [7, 8, 9, 10, 11]},
            "4,16": {7: [1, 2, 3, 4]},
            "5,17": {7: [5, 6, 7, 8]},
            "6,18": {6: [4, 5, 6]},
            "7,19": {9: [1, 2, 3, 4, 5]},
            "8,20": {8: [1, 2, 3, 4, 5]},
            "9,21": {5: [8, 9, 10, 11]},
            "10,22": {10: [1, 2, 3]},
            "11,23": {8: [6, 7, 8, 9, 10, 11]}
        },
        "getHour": function(date) {
            var hour = date.getHours();
            if (date.getMinutes() >= 35) {
                return (hour + 1) % 24;
            }
            return hour;
        }
    };
    $.fritteli.uhr.register('en', layout);
}(jQuery));
(function($) {
    'use strict';
    var es_la = {1: [1, 2, 6, 7]};
    var son_las = {1: [2, 3, 4, 6, 7, 8]};
    var y = {7: [6]};
    var menos = {7: [7, 8, 9, 10, 11]};
    var media = {10: [1, 2, 3, 4, 5]};
    var cinco = {9: [7, 8, 9, 10, 11]};
    var diez = {8: [8, 9, 10, 11]};
    var cuarto = {10: [6, 7, 8, 9, 10, 11]};
    var veinte = {8: [2, 3, 4, 5, 6, 7]};
    var veinticinco = {9: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]};

    var layout = {
        "version": 2,
        "language": 'Español',
        "letters": [
            'ESONELASUNA',
            'DOSITRESORE',
            'CUATROCINCO',
            'SEISASIETEN',
            'OCHONUEVEYO',
            'LADIEZSONCE',
            'DOCELYMENOS',
            'OVEINTEDIEZ',
            'VEINTICINCO',
            'MEDIACUARTO'
        ],
        "permanent": [],
        "minutes": {
            "5,6,7,8,9": [y, cinco],
            "10,11,12,13,14": [y, diez],
            "15,16,17,18,19": [y, cuarto],
            "20,21,22,23,24": [y, veinte],
            "25,26,27,28,29": [y, veinticinco],
            "30,31,32,33,34": [y, media],
            "35,36,37,38,39": [menos, veinticinco],
            "40,41,42,43,44": [menos, veinte],
            "45,46,47,48,49": [menos, cuarto],
            "50,51,52,53,54": [menos, diez],
            "55,56,57,58,59": [menos, cinco]
        },
        "hours": {
            "0,12": [son_las, {7: [1, 2, 3, 4]}],
            "1,13": [es_la, {1: [9, 10, 11]}],
            "2,14": [son_las, {2: [1, 2, 3]}],
            "3,15": [son_las, {2: [5, 6, 7, 8]}],
            "4,16": [son_las, {3: [1, 2, 3, 4, 5, 6]}],
            "5,17": [son_las, {3: [7, 8, 9, 10, 11]}],
            "6,18": [son_las, {4: [1, 2, 3, 4]}],
            "7,19": [son_las, {4: [6, 7, 8, 9, 10]}],
            "8,20": [son_las, {5: [1, 2, 3, 4]}],
            "9,21": [son_las, {5: [5, 6, 7, 8, 9]}],
            "10,22": [son_las, {6: [3, 4, 5, 6]}],
            "11,23": [son_las, {6: [8, 9, 10, 11]}]
        },
        "getHour": function(date) {
            var hour = date.getHours();
            if (date.getMinutes() >= 35) {
                return (hour + 1) % 24;
            }
            return hour;
        }
    };
    $.fritteli.uhr.register('es', layout);
}(jQuery));

(function($) {
    'use strict';
    var il_est = {1: [1, 2, 4, 5, 6]};
    var et = {8: [1, 2]};
    var moins = {7: [1, 2, 3, 4, 5]};
    var demie = {10: [4, 5, 6, 7, 8]};
    var heures = {6: [6, 7, 8, 9, 10, 11]};
    var le = {7: [7, 8]};
    var cinq = {9: [7, 8, 9, 10]};
    var dix = {7: [9, 10, 11]};
    var quart = {8: [4, 5, 6, 7, 8]};
    var vingt = {9: [1, 2, 3, 4, 5]};
    var vingtcinq = {9: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]};

    var layout = {
        "version": 2,
        "language": 'Français',
        "letters": [
            'ILNESTODEUX',
            'QUATRETROIS',
            'NEUFUNESEPT',
            'HUITSIXCINQ',
            'MIDIXMINUIT',
            'ONZERHEURES',
            'MOINSOLEDIX',
            'ETRQUARTPMD',
            'VINGT-CINQU',
            'ETSDEMIEPAM'
        ],
        "permanent": il_est,
        "minutes": {
            "5,6,7,8,9": cinq,
            "10,11,12,13,14": dix,
            "15,16,17,18,19": [et, quart],
            "20,21,22,23,24": vingt,
            "25,26,27,28,29": vingtcinq,
            "30,31,32,33,34": [et, demie],
            "35,36,37,38,39": [moins, vingtcinq],
            "40,41,42,43,44": [moins, vingt],
            "45,46,47,48,49": [moins, le, quart],
            "50,51,52,53,54": [moins, dix],
            "55,56,57,58,59": [moins, cinq]
        },
        "hours": {
            "0": {5: [6, 7, 8, 9, 10, 11]},
            "1,13": [
                {3: [5, 6, 7]},
                heures
            ],
            "2,14": [
                {1: [8, 9, 10, 11]},
                heures
            ],
            "3,15": [
                {2: [7, 8, 9, 10, 11]},
                heures
            ],
            "4,16": [
                {2: [1, 2, 3, 4, 5, 6]},
                heures
            ],
            "5,17": [
                {4: [8, 9, 10, 11]},
                heures
            ],
            "6,18": [
                {4: [5, 6, 7]},
                heures
            ],
            "7,19": [
                {3: [8, 9, 10, 11]},
                heures
            ],
            "8,20": [
                {4: [1, 2, 3, 4]},
                heures
            ],
            "9,21": [
                {3: [1, 2, 3, 4]},
                heures
            ],
            "10,22": [
                {5: [3, 4, 5]},
                heures
            ],
            "11,23": [
                {6: [1, 2, 3, 4]},
                heures
            ],
            "12": {5: [1, 2, 3, 4]}
        },
        "getHour": function(date) {
            var hour = date.getHours();
            if (date.getMinutes() >= 35) {
                return (hour + 1) % 24;
            }
            return hour;
        }
    };
    $.fritteli.uhr.register('fr', layout);
}(jQuery));
(function($) {
    'use strict';
    var sono_le = {1: [1, 2, 3, 4, 6, 7]};
    var e_l = {2: [1, 3, 4]};
    var e = {8: [1]};
    var meno = {7: [8, 9, 10, 11]};
    var mezza = {10: [7, 8, 9, 10, 11]};
    var cinque = {9: [6, 7, 8, 9, 10, 11]};
    var dieci = {10: [1, 2, 3, 4, 5]};
    var un_quarto = {8: [3, 4, 6, 7, 8, 9, 10, 11]};
    var venti = {9: [1, 2, 3, 4, 5]};
    var venticinque = {9: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]};

    var layout = {
        "version": 2,
        "language": 'Italiano',
        "letters": [
            'SONORLEBORE',
            'ÈRL\'UNASDUE',
            'TREOTTONOVE',
            'DIECIUNDICI',
            'DODICISETTE',
            'QUATTROCSEI',
            'CINQUEAMENO',
            'ECUNOQUARTO',
            'VENTICINQUE',
            'DIECIPMEZZA'
        ],
        "permanent": [],
        "minutes": {
            "5,6,7,8,9": [e, cinque],
            "10,11,12,13,14": [e, dieci],
            "15,16,17,18,19": [e, un_quarto],
            "20,21,22,23,24": [e, venti],
            "25,26,27,28,29": [e, venticinque],
            "30,31,32,33,34": [e, mezza],
            "35,36,37,38,39": [meno, venticinque],
            "40,41,42,43,44": [meno, venti],
            "45,46,47,48,49": [meno, un_quarto],
            "50,51,52,53,54": [meno, dieci],
            "55,56,57,58,59": [meno, cinque]
        },
        "hours": {
            "0,12": [sono_le, {5: [1, 2, 3, 4, 5, 6]}],
            "1,13": [e_l, {2: [5, 6, 7]}],
            "2,14": [sono_le, {2: [9, 10, 11]}],
            "3,15": [sono_le, {3: [1, 2, 3]}],
            "4,16": [sono_le, {6: [1, 2, 3, 4, 5, 6, 7]}],
            "5,17": [sono_le, {7: [1, 2, 3, 4, 5, 6]}],
            "6,18": [sono_le, {6: [9, 10, 11]}],
            "7,19": [sono_le, {5: [7, 8, 9, 10, 11]}],
            "8,20": [sono_le, {3: [4, 5, 6, 7]}],
            "9,21": [sono_le, {3: [8, 9, 10, 11]}],
            "10,22": [sono_le, {4: [1, 2, 3, 4, 5]}],
            "11,23": [sono_le, {4: [6, 7, 8, 9, 10, 11]}]
        },
        "getHour": function(date) {
            var hour = date.getHours();
            if (date.getMinutes() >= 35) {
                return (hour + 1) % 24;
            }
            return hour;
        }
    };
    $.fritteli.uhr.register('it', layout);
}(jQuery));
(function($) {
    'use strict';
    var het_is = {1: [1, 2, 3, 5, 6]};
    var over1 = {3: [1, 2, 3, 4]};
    var voor1 = {2: [8, 9, 10, 11]};
    var over2 = {4: [8, 9, 10, 11]};
    var voor2 = {5: [1, 2, 3, 4]};
    var half = {4: [1, 2, 3, 4]};
    var vijf = {1: [8, 9, 10, 11]};
    var tien = {2: [1, 2, 3, 4]};
    var kwart = {3: [7, 8, 9, 10, 11]};
    var uur = {10: [9, 10, 11]};

    var layout = {
        "version": 2,
        "language": 'Nederlands',
        "letters": [
            'HETKISAVIJF',
            'TIENBTZVOOR',
            'OVERMEKWART',
            'HALFSPWOVER',
            'VOORTHGEENS',
            'TWEEPVCDRIE',
            'VIERVIJFZES',
            'ZEVENONEGEN',
            'ACHTTIENELF',
            'TWAALFBFUUR'
        ],
        "permanent": het_is,
        "minutes": {
            "0,1,2,3,4": uur,
            "5,6,7,8,9": [vijf, over1],
            "10,11,12,13,14": [tien, over1],
            "15,16,17,18,19": [kwart, over2],
            "20,21,22,23,24": [tien, voor1, half],
            "25,26,27,28,29": [vijf, voor1, half],
            "30,31,32,33,34": half,
            "35,36,37,38,39": [vijf, over1, half],
            "40,41,42,43,44": [tien, over1, half],
            "45,46,47,48,49": [kwart, voor2],
            "50,51,52,53,54": [tien, voor1],
            "55,56,57,58,59": [vijf, voor1]
        },
        "hours": {
            "0,12": {10: [1, 2, 3, 4, 5, 6]},
            "1,13": {5: [8, 9, 10]},
            "2,14": {6: [1, 2, 3, 4]},
            "3,15": {6: [8, 9, 10, 11]},
            "4,16": {7: [1, 2, 3, 4]},
            "5,17": {7: [5, 6, 7, 8]},
            "6,18": {7: [9, 10, 11]},
            "7,19": {8: [1, 2, 3, 4, 5]},
            "8,20": {9: [1, 2, 3, 4]},
            "9,21": {8: [7, 8, 9, 10, 11]},
            "10,22": {9: [5, 6, 7, 8]},
            "11,23": {9: [9, 10, 11]}
        },
        "getHour": function(date) {
            var hour = date.getHours();
            if (date.getMinutes() >= 20) {
                return (hour + 1) % 24;
            }
            return hour;
        }
    };
    $.fritteli.uhr.register('nl', layout);
}(jQuery));
(function ($) {
    'use strict';
    var e_ = {1: [1]};
    var sao = {1: [2, 3, 4]};
    var e1 = {7: [8]};
    var e2 = {10: [5]};
    var menos = {7: [7, 8, 9, 10, 11]};
    var meia = {8: [8, 9, 10, 11]};
    var cinco = {10: [7, 8, 9, 10, 11]};
    var dez = {10: [1, 2, 3]};
    var um_quarto = {9: [1, 2, 4, 5, 6, 7, 8, 9]};
    var vinte = {8: [1, 2, 3, 4, 5]};
    var layout = {
        "version": 2,
        "language": 'Português',
        "letters": [
            'ÉSÃOUMATRÊS',
            'MEIOLDIADEZ',
            'DUASEISETEY',
            'QUATROHNOVE',
            'CINCOITONZE',
            'ZMEIALNOITE',
            'HORASYMENOS',
            'VINTECAMEIA',
            'UMVQUARTOPM',
            'DEZOEYCINCO'
        ],
        "minutes": {
            "5,6,7,8,9": [e1, cinco],
            "10,11,12,13,14": [e1, dez],
            "15,16,17,18,19": [e1, um_quarto],
            "20,21,22,23,24": [e1, vinte],
            "25,26,27,28,29": [e1, vinte, e2, cinco],
            "30,31,32,33,34": [e1, meia],
            "35,36,37,38,39": [menos, vinte, e2, cinco],
            "40,41,42,43,44": [menos, vinte],
            "45,46,47,48,49": [menos, um_quarto],
            "50,51,52,53,54": [menos, dez],
            "55,56,57,58,59": [menos, cinco]
        },
        "hours": {
            "0": [e_, {"6": [2, 3, 4, 5, 7, 8, 9, 10, 11]}],
            "12": [e_, {"2": [1, 2, 3, 4, 6, 7, 8]}],
            "1,13": [e_, {"1": [5, 6, 7]}],
            "2,14": [sao, {"3": [1, 2, 3, 4]}],
            "3,15": [sao, {"1": [8, 9, 10, 11]}],
            "4,16": [sao, {"4": [1, 2, 3, 4, 5, 6]}],
            "5,17": [sao, {"5": [1, 2, 3, 4, 5]}],
            "6,18": [sao, {"3": [4, 5, 6, 7]}],
            "7,19": [sao, {"3": [7, 8, 9, 10]}],
            "8,20": [sao, {"5": [5, 6, 7, 8]}],
            "9,21": [sao, {"4": [8, 9, 10, 11]}],
            "10,22": [sao, {"2": [9, 10, 11]}],
            "11,23": [sao, {"5": [8, 9, 10, 11]}]
        },
        "getHour": function (date) {
            var hour = date.getHours();
            if (date.getMinutes() >= 35) {
                return (hour + 1) % 24;
            }
            return hour;
        }
    };
    $.fritteli.uhr.register('pt', layout);
}(jQuery));
