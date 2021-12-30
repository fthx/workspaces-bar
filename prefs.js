const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;

const SCHEMA_NAME = 'org.gnome.shell.extensions.workspaces-bar';

function init() {
}

function buildPrefsWidget() {
    let widget = new PrefsWidget();
    return widget.widget;
}

class PrefsWidget {
    constructor() {
        this.gsettings = ExtensionUtils.getSettings(SCHEMA_NAME);

        this.widget = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 10,
            margin_bottom: 10,
            margin_start: 10,
            margin_end: 10,
        });

        this.vbox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 0,
            hexpand: true,
        });
        this.vbox.set_size_request(550, 250);

        this.vbox.append(this.addRenaming());
        this.widget.append(this.vbox);
    }

    addRenaming() {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 5 });
        let setting_label = new Gtk.Label({ label: "Enable renaming menu", xalign: 0, hexpand: true });
        this.setting_switch = new Gtk.Switch({ active: this.gsettings.get_boolean('renaming') });

        this.setting_switch.connect('notify::active', (button) => { this.gsettings.set_boolean('renaming', button.active); });

        hbox.append(setting_label);
        hbox.append(this.setting_switch);

        return hbox;
    }
}

