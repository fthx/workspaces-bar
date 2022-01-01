/* 
    Workspaces Bar
    Copyright Francois Thirioux 2021
    GitHub contributors: @fthx
    License GPL v3
*/


const { Clutter, Gio, GObject, Shell, St } = imports.gi;
const Lang = imports.lang
const PopupMenu = imports.ui.popupMenu;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const ExtensionUtils = imports.misc.extensionUtils;

var WORKSPACES_SCHEMA = "org.gnome.desktop.wm.preferences";
var WORKSPACES_KEY = "workspace-names";
const WORKSPACES_BAR_SCHEMA = 'org.gnome.shell.extensions.workspaces-bar';


var WorkspacesBar = GObject.registerClass(
class WorkspacesBar extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Workspaces bar');
        
        // define gsettings schema for workspaces names, get workspaces names, signal for settings key changed
        this.workspaces_settings = new Gio.Settings({ schema: WORKSPACES_SCHEMA });
        this.workspaces_names_changed = this.workspaces_settings.connect(`changed::${WORKSPACES_KEY}`, this._update_workspaces_names.bind(this));
    
        // hide Activities button
        this._show_activities(false);
    
        // bar creation
        this.ws_bar = new St.BoxLayout({});
        this._update_workspaces_names();
        this.add_child(this.ws_bar);
        
        // signals for workspaces state: active workspace, number of workspaces
        this._ws_active_changed = global.workspace_manager.connect('active-workspace-changed', this._update_ws.bind(this));
        this._ws_number_changed = global.workspace_manager.connect('notify::n-workspaces', this._update_ws.bind(this));
        this._restacked = global.display.connect('restacked', this._update_ws.bind(this));
        this._windows_changed = Shell.WindowTracker.get_default().connect('tracked-windows-changed', this._update_ws.bind(this));

        // setup settings
        this._renaming = false;

        this._gsettings = ExtensionUtils.getSettings(WORKSPACES_BAR_SCHEMA);
        this._gsettings.connect("changed::renaming", this._renaming_changed.bind(this));
        this._renaming_changed();

        // if enabled, make popup menu only open on right/middle click
        var click_handler = function(origin, event) {
            const key = event.get_button();
            if (this._renaming) {
                if (key == 1) {
                    this.menu.close();
                }
            } else {
                this.menu.close();
            }
        };
        this.connect('button-press-event', Lang.bind(this, click_handler));
    }

    // remove signals, restore Activities button, destroy workspaces bar
    _destroy() {
        this._show_activities(true);
        if (this._ws_active_changed) {
            global.workspace_manager.disconnect(this._ws_active_changed);
        }
        if (this._ws_number_changed) {
            global.workspace_manager.disconnect(this._ws_number_changed);
        }
        if (this._restacked) {
            global.display.disconnect(this._restacked);
        }
        if (this._windows_changed) {
            Shell.WindowTracker.get_default().disconnect(this._windows_changed);
        }
        if (this.workspaces_names_changed) {
            this.workspaces_settings.disconnect(this.workspaces_names_changed);
        }
        this.ws_bar.destroy();
        super.destroy();
    }

    // build a context popup menu with the workspace name entries
    _build_menu() {
        // remove all menu items
        this.menu.removeAll();

        // array of entry widgets
        let entries = [];

        // add a menu item for each workspace
        for (let ws_index = 0; ws_index < this.ws_count; ++ws_index) {
            let menu_item = new PopupMenu.PopupBaseMenuItem({
                reactive: false,
                can_focus: false
            });
            let ws_name_entry = new St.Entry({
                name: 'ws_entry' + (ws_index + 1),
                style_class: 'workspace-name-entry',
                can_focus: true,
                hint_text: _('Workspace name...'),
                track_hover: true,
                x_expand: true,
                y_expand: true
            });

            // set the text to workspace names
            if (this.workspaces_names[ws_index]) {
                ws_name_entry.set_text("" + this.workspaces_names[ws_index] + "");
            } else {
                ws_name_entry.set_text("  " + (ws_index + 1) + "  ");
            }

            // make entry trigger rename of this workspace on pressing enter
            var enter_handler = function(origin, event) {
                const key = event.get_key_symbol();
                if (key == Clutter.KEY_Return || key == Clutter.KEY_KP_Enter || key == Clutter.KEY_ISO_Enter) {
                    this._rename_ws(ws_index, origin.get_text());
                }
            };
            ws_name_entry.get_clutter_text().connect(
                'key-press-event', Lang.bind(this, enter_handler)
            );

            // add menu item
            menu_item.add(ws_name_entry);
            this.menu.addMenuItem(menu_item);

            // keep track of entry widget
            entries.push(ws_name_entry);
        }

        // add menu item for renaming all workspaces at once
        let rename_menu_item = new PopupMenu.PopupMenuItem(_('Rename'));
        this.menu.addMenuItem(rename_menu_item);
        rename_menu_item.connect('activate', this._rename_all.bind(this)));

        this.menu_entries = entries;
    }
    
    // hide Activities button
    _show_activities(show) {
        this.activities_button = Main.panel.statusArea['activities'];
        if (this.activities_button) {
            if (show && !Main.sessionMode.isLocked) {
                this.activities_button.container.show();
            } else {
                this.activities_button.container.hide();
            }
        }
    }
    
    // update workspaces names
    _update_workspaces_names() {
        this.workspaces_names = this.workspaces_settings.get_strv(WORKSPACES_KEY);
        this._update_ws();
        // build the menu
        this._build_menu();
    }

    // update the workspaces bar
    _update_ws() {
        // destroy old workspaces bar buttons
        this.ws_bar.destroy_all_children();
        
        // get number of workspaces
        this.ws_count = global.workspace_manager.get_n_workspaces();
        this.active_ws_index = global.workspace_manager.get_active_workspace_index();
        
        // display all current workspaces buttons
        for (let ws_index = 0; ws_index < this.ws_count; ++ws_index) {
            this.ws_box = new St.Bin({visible: true, reactive: true, can_focus: true, track_hover: true});                      
            this.ws_box.label = new St.Label({y_align: Clutter.ActorAlign.CENTER});
            if (ws_index == this.active_ws_index) {
                if (global.workspace_manager.get_workspace_by_index(ws_index).n_windows > 0) {
                    this.ws_box.label.style_class = 'desktop-label-nonempty-active';
                } else {
                    this.ws_box.label.style_class = 'desktop-label-empty-active';
                }
            } else {
                if (global.workspace_manager.get_workspace_by_index(ws_index).n_windows > 0) {
                    this.ws_box.label.style_class = 'desktop-label-nonempty-inactive';
                } else {
                    this.ws_box.label.style_class = 'desktop-label-empty-inactive';
                }
            }
            if (this.workspaces_names[ws_index]) {
                this.ws_box.label.set_text("" + this.workspaces_names[ws_index] + "");
            } else {
                this.ws_box.label.set_text("  " + (ws_index + 1) + "  ");
            }
            this.ws_box.set_child(this.ws_box.label);

            // if renaming is enabled, only switch to workspace on left click when popup menu is not open
            this.ws_box.connect('button-press-event', (origin, event) => {
                if (this._renaming) {
                    if (event.get_button() == 1 && !this.menu.isOpen) {
                        this._toggle_ws(ws_index);
                    }
                } else {
                    this._toggle_ws(ws_index);
                }
            });
            
            this.ws_bar.add_actor(this.ws_box);
        }
    }

    // activate workspace or show overview
    _toggle_ws(ws_index) {
        if (global.workspace_manager.get_active_workspace_index() == ws_index) {
            Main.overview.toggle();
        } else {
            global.workspace_manager.get_workspace_by_index(ws_index).activate(global.get_current_time());
        }
    }

    // rename all workspaces
    _rename_all() {
        // check if menu and workspace number match
        if (this.menu_entries.length != this.workspaces_names.length) {return;}

        // build array of new workspace names
        let new_workspaces_names = [];
        for (let i = 0; i < this.menu_entries.length; i++) {
            let new_name = this.menu_entries[i].get_text();
            new_workspaces_names.push(new_name);
        }
        
        // set workspace names
        this.workspaces_settings.set_strv(WORKSPACES_KEY, new_workspaces_names);
    }

    // rename workspace with given index
    _rename_ws(ws_index, ws_name) {
        // build array with altered workspace name
        let new_workspaces_names = Array.from(this.workspaces_names);
        new_workspaces_names[ws_index] = ws_name;

        // set workspace names
        this.workspaces_settings.set_strv(WORKSPACES_KEY, new_workspaces_names);
    }

    // handle (de)activation of renaming
    _renaming_changed() {
        this._renaming = this._gsettings.get_boolean('renaming');
    }
});

class Extension {
    constructor() {
    }

    enable() {
        this.workspaces_bar = new WorkspacesBar();
        Main.panel.addToStatusArea('workspaces-bar', this.workspaces_bar, 0, 'left');
    }

    disable() {
        this.workspaces_bar._destroy();
    }
}

function init() {
    return new Extension();
}

