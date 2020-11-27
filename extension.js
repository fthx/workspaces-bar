/* 
	Workspaces Bar
	Copyright Francois Thirioux 2020
	GitHub contributors: @fthx
	License GPL v3
*/

const { Clutter, GObject, St } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const Lang = imports.lang;

var WorkspacesBar = GObject.registerClass(
class WorkspacesBar extends PanelMenu.Button {
	_init() {
		super._init(0.0, 'Workspaces bar');
		
		// hide Activities button
		this._show_activities(false);
	
		// bar creation
		this.ws_bar = new St.BoxLayout({});
        this._update_ws();
        
        // signals: active workspace, number of workspaces
		this._ws_active_changed = global.workspace_manager.connect('active-workspace-changed', Lang.bind(this, this._update_ws));
		this._ws_number_changed = global.workspace_manager.connect('notify::n-workspaces', Lang.bind(this, this._update_ws));
	}

	// remove signals, restore Activities button, destroy workspaces bar
	_destroy() {
		this._show_activities(true);
		global.workspace_manager.disconnect(this._ws_active_changed);
		global.workspace_manager.disconnect(this._ws_number_changed);
		this.ws_bar.destroy();
		super.destroy();
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

	// update the workspaces bar
    _update_ws() {   
    	// destroy old workspaces bar buttons
    	this.ws_bar.destroy_all_children();
    	
    	// get number of workspaces
        this.ws_count = global.workspace_manager.get_n_workspaces();
		
		// display all current workspaces buttons
        for (let ws_index = 0; ws_index < this.ws_count; ++ws_index) {
			this.ws_box = new St.Bin({visible: true, reactive: true, can_focus: true, track_hover: true});						
			this.ws_box.label = new St.Label({y_align: Clutter.ActorAlign.CENTER});
			if (global.workspace_manager.get_active_workspace_index() == ws_index) {
					this.ws_box.label.style_class = 'desk-label-active';
			} else {
				this.ws_box.label.style_class = 'desk-label-inactive';
			};
			this.ws_box.label.set_text("  " + (ws_index + 1) + "  ");
			this.ws_box.set_child(this.ws_box.label);
			this.ws_box.connect('button-press-event', Lang.bind(this, function() { this._toggle_ws(ws_index); } ));
	        this.ws_bar.add_actor(this.ws_box);
		};
		
		// display workspaces bar
		this.add_child(this.ws_bar);
    }

    // activate workspace or show overview
    _toggle_ws(ws_index) {
		if (global.workspace_manager.get_active_workspace_index() == ws_index) {
			Main.overview.toggle();
		}
		global.workspace_manager.get_workspace_by_index(ws_index).activate(global.get_current_time());
    }
});

var workspaces_bar;

function init() {
}

function enable() {
    // activate and display workspaces bar in the left side of the panel
	workspaces_bar = new WorkspacesBar();
    Main.panel.addToStatusArea('workspaces-bar', workspaces_bar, 0, 'left');
}

function disable() {
	// destroy workspaces bar and show Activities button
	workspaces_bar._destroy();
}
