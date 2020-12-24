/**
 * Main application page.
 */
'use strict';

define(['workspacebase', 'mainlayout', 'dragndrop', 'utils'],
    function (WorkspaceBase, appLayout, DragAndDrop, Utils)
    {
        function AppBase(appContainer, initializers, checker) {
            if (!checker()) {
                alert('WebGL technology is not enabled in your browser or not supported at all. Turn it on or try to use a proper machine to get `ili functioning properly.');
            }
            this._appContainer = document.createElement('div');
            this._appContainer.id = 'ili-container';
            this._appContainer.innerHTML = appLayout;
            appContainer.appendChild(this._appContainer);

            this._spotsController = initializers.createSpotsController();
            this._workspace = initializers.createWorkspace(this._spotsController);
            this._views = initializers.createViewContainer(this._workspace, this._appContainer.querySelector('#view-container'));
            this._mapSelector = initializers.createMapSelector(this._workspace, 
                this._appContainer.querySelector('#map-selector'),
                this._appContainer.querySelector('#current-map-label'));
            this._settingsController = initializers.createSettingsController(this._appContainer, this._workspace, this._views);

            this._workspace.addEventListener(WorkspaceBase.Events.STATUS_CHANGE, this._onWorkspaceStatusChange.bind(this));
            this._workspace.addEventListener(WorkspaceBase.Events.ERRORS_CHANGE, this._onWorkspaceErrorsChange.bind(this));

            this._initKeyboardShortcuts();

            this._appContainer.querySelector('#controls-switcher').onclick = this._toggleControls.bind(this);
            this._appContainer.querySelector('#open-button').onclick = this.chooseFilesToOpen.bind(this);
            this._appContainer.querySelector('#current-map-label').onclick = this._mapSelector.activate.bind(this._mapSelector);
            this._appContainer.querySelector('#view-container').onmousedown = this._mapSelector.deactivate.bind(this._mapSelector);
            this._appContainer.querySelector('div#errors #close').onclick = this._workspace.clearErrors.bind(this._workspace);

            window.addEventListener('resize', function () {
                this.resize.call(this, window.innerWidth, window.innerHeight);
            }.bind(this));

            this._dnd = new DragAndDrop(this._appContainer, this._workspace.loadFiles.bind(this._workspace));

            this._controlsVisible = true;
            this._processAddressLine();
        };

        AppBase.prototype = Object.create(null, {
            chooseFilesToOpen: {
                value: function() {
                    var fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.multiple = true;
                    fileInput.addEventListener('change', function () {
                        this._workspace.loadFiles(
                            // handle files in the same way as drag and drop
                            Array.from(fileInput.files).map(function (file) {
                                return new Utils.File(file, file.name);
                            })
                        );
                    }.bind(this));
                    fileInput.click();
                }
            },

            takeSnapshot: {
                value: function() {
                    var name = this._spotsController.mapName || 'image';
                    this._views.export().then(function(blob) {
                        saveAs(blob, name + '.png', 'image/png');
                    });
                }
            },

            resize: {
                value: function(width, height) {
                    this._views.updateLayout();
                }
            },

            saveSettings: {
                value: function () {
                    var name = this._spotsController.mapName || 'ili_settings';
                    saveAs(this._settingsController.serialize(), name + '.json');
                }
            },


            /* Property used to show/hide the sidebar
             */
            controlsVisible: {
                get: function() {
                    return this._controlsVisible;
                },
                set: function (visible) {
                    visible = !!visible;
                    if (visible !== this._controlsVisible) {
                        var controlsSwitcher = this._appContainer.querySelector('#controls-switcher');
                        controlsSwitcher.click();
                        controlsSwitcher.style.visibility = visible ? 'visible' : 'hidden';
                        this._controlsVisible = visible;
                    }
                }
            },

            _initKeyboardShortcuts: {
                value: function() {
                    this._keyboardShortcuts = {
                        '38': function() { // ArrowUp
                            this._mapSelector.blink();
                            this._mapSelector.navigate(MapSelector.Direction.UP);
                        },
                        '40': function() { // ArrowDown
                            this._mapSelector.blink();
                            this._mapSelector.navigate(MapSelector.Direction.DOWN);
                        }
                    };
                    this._keyboardShortcuts[Utils.isWebkit ? '79' : '111'] = this.chooseFilesToOpen; // Ctrl + O
                    this._keyboardShortcuts[Utils.isWebkit ? '70' : '102'] = function() { this._mapSelector.activate(); }; // Ctrl + F
                    this._keyboardShortcuts[Utils.isWebkit ? '83' : '115'] = this.takeSnapshot; // Ctrl + S
                    this._keyboardShortcuts[Utils.isWebkit ? '69' : '101'] = this.saveSettings; // Ctrl + E

                    document.addEventListener(Utils.keyPressEvent(), this._onKeyPress.bind(this), false);
                }
            },

            _onKeyPress: {
                value: function(event) {
                    if ((/^Mac/i).test(navigator.platform)) {
                        if (event.ctrlKey || event.altKey || !event.metaKey) return;
                    } else {
                        if (!event.ctrlKey || event.altKey || event.metaKey) return;
                    }

                    var key = (event.which ? event.which : event.keyCode).toString();
                    if (key in this._keyboardShortcuts) {
                        event.preventDefault();
                        var handler = this._keyboardShortcuts[key];
                        handler.call(this);
                        return false;
                    }
                }
            },

            _clickControlSwitch: {
                value: function() {
                    var controlsSwitcher = this._appContainer.querySelector('#controls-switcher');
                    controlsSwitcher.click();
                }
            },

            _processAddressLine: {
                value: function() {
                    if (window.location.search) {
                        this._clickControlSwitch();
                        var fileNames = window.location.search.substr(1).split(';');
                        this._workspace.download(fileNames);
                    }
                }
            },

            _onWorkspaceStatusChange: {
                value: function() {
                    var statusContainer = this._appContainer.querySelector('#status');
                    if (this._workspace.status) {
                        var textField = statusContainer.querySelector('span');
                        textField.innerHTML = this._workspace.status;
                        statusContainer.style.visibility = 'visible';
                    } else {
                        statusContainer.style.visibility = 'hidden';
                    }
                }
            },

            _onWorkspaceErrorsChange: {
                value: function () {
                    var errorBox = this._appContainer.querySelector('div#errors');
                    var list = errorBox.querySelector('ul');
                    list.textContent = '';
                    this._workspace.errors.forEach(function (error) {
                        var item = document.createElement('li');
                        item.textContent = error;
                        list.appendChild(item);
                    });
                    if (this._workspace.errors.length == 0) {
                        errorBox.setAttribute('hidden', 'true');
                    } else {
                        errorBox.removeAttribute('hidden');
                    }
                }
            },

            _toggleControls: {
                value: function () {
                    // timeout is used because a blank vertical stripe remains from a scrollbar of the sidebar,
                    // which gets updated asynchronously, it seems
                    window.setTimeout(function () {
                        // update rendering area width
                        var renderingArea = $(this._appContainer.querySelector('#rendering-area'));
                        renderingArea.toggleClass('col-xs-8');
                        renderingArea.toggleClass('col-xs-12');
                        // change toggle button icon
                        var sideBarSwitcher = $(this._appContainer.querySelector('#controls-switcher .glyphicon'));
                        sideBarSwitcher.toggleClass('glyphicon-chevron-right');
                        sideBarSwitcher.toggleClass('glyphicon-chevron-left');
                        // redraw the scene
                        this._views.updateLayout();
                    }.bind(this));
                }
            },
        });
        return AppBase;
});
