/*
 * Copyright (C) 2013 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @constructor
 * @param {!function()} onHide
 * @extends {WebInspector.HelpScreen}
 */
WebInspector.ExportNetworkScreen = function(onHide, rnd)
{
    WebInspector.HelpScreen.call(this);
    this.registerRequiredCSS("exportNetworkScreen.css");
    this.element.id = "ExportNetwork-screen";

    /** @type {function()} */
    this._onHide = onHide;

    this._tabbedPane = new WebInspector.TabbedPane();
    this._tabbedPane.element.classList.add("help-window-main");
    this._tabbedPane.element.appendChild(this._createCloseButton());

    WebInspector.ExportNetworkScreen.Tabs.ExportNetwork = '';
    var exportNetworkTab = new WebInspector.ExportNetworkTab(rnd);
    this._tabbedPane.appendTab(WebInspector.ExportNetworkScreen.Tabs.ExportNetwork, WebInspector.ExportNetworkScreen.Tabs.ExportNetwork, exportNetworkTab);
    this._tabbedPane.selectTab(exportNetworkTab.id);

    this._tabbedPane.shrinkableTabs = false;
    this._tabbedPane.verticalTabLayout = true;
}

WebInspector.ExportNetworkScreen.prototype = {
    /**
     * @override
     */
    wasShown: function()
    {
        this._tabbedPane.show(this.element);
        WebInspector.HelpScreen.prototype.wasShown.call(this);
    },

    /**
     * @override
     * @return {boolean}
     */
    isClosingKey: function(keyCode)
    {
        return [
            WebInspector.KeyboardShortcut.Keys.Enter.code,
            WebInspector.KeyboardShortcut.Keys.Esc.code,
        ].indexOf(keyCode) >= 0;
    },

    /**
     * @override
     */
    willHide: function()
    {
        this._onHide();
        WebInspector.HelpScreen.prototype.willHide.call(this);
    },

    __proto__: WebInspector.HelpScreen.prototype
}

WebInspector.ExportNetworkScreen.Tabs = {
    ExportNetwork: ""
}

WebInspector.ExportNetworkTab = function(rnd) {
    WebInspector.VBox.call(this);
    this.rnd = rnd;

    var rndContainer = this.element.createChild("div");
    rndContainer.style.overflow = 'hidden';
    var rndMessage = rndContainer.createChild("h3");
    rndMessage.innerText = 'Paste this raw network data into a file with extention .rnd.  ' +
    	'Use Import Raw... to load the raw network data from that file.';
	var rndTextarea = rndContainer.createChild("textarea");
	rndTextarea.rows = 50;
	rndTextarea.style.resize = 'vertical';
	rndTextarea.style.width = '100%';

	rndTextarea.value = rnd;
}

WebInspector.ExportNetworkTab.prototype = {
    __proto__: WebInspector.VBox.prototype
}