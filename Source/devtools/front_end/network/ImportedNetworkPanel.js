/*
 * Copyright (C) 2007, 2008 Apple Inc.  All rights reserved.
 * Copyright (C) 2008, 2009 Anthony Ricaud <rik@webkit.org>
 * Copyright (C) 2011 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of Apple Computer, Inc. ("Apple") nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE AND ITS CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL APPLE OR ITS CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @constructor
 * @implements {WebInspector.ContextMenu.Provider}
 * @implements {WebInspector.Searchable}
 * @extends {WebInspector.Panel}
 */
WebInspector.ImportedNetworkPanel = function()
{
    WebInspector.Panel.call(this, "importednetwork");
    this.registerRequiredCSS("importedNetworkPanel.css");
    this._injectStyles();

    this._panelStatusBarElement = this.element.createChild("div", "panel-status-bar");
    this._filterBar = new WebInspector.FilterBar();
    this._filtersContainer = this.element.createChild("div", "network-filters-header hidden");
    this._filtersContainer.appendChild(this._filterBar.filtersElement());
    this._filterBar.addEventListener(WebInspector.FilterBar.Events.FiltersToggled, this._onFiltersToggled, this);
    this._filterBar.setName("importednetworkPanel");

    this._searchableView = new WebInspector.SearchableView(this);
    this._searchableView.show(this.element);
    this._contentsElement = this._searchableView.element;

    this._splitView = new WebInspector.SplitView(true, false, "networkPanelSplitViewState");
    this._splitView.show(this._contentsElement);
    this._splitView.hideMain();

    var defaultColumnsVisibility = WebInspector.NetworkLogView._defaultColumnsVisibility;
    var networkLogColumnsVisibilitySetting = WebInspector.settings.createSetting("networkLogColumnsVisibility", defaultColumnsVisibility);
    var savedColumnsVisibility = networkLogColumnsVisibilitySetting.get();
    var columnsVisibility = {};
    for (var columnId in defaultColumnsVisibility)
        columnsVisibility[columnId] = savedColumnsVisibility.hasOwnProperty(columnId) ? savedColumnsVisibility[columnId] : defaultColumnsVisibility[columnId];
    networkLogColumnsVisibilitySetting.set(columnsVisibility);

    this._networkLogView = new WebInspector.NetworkLogView(this._filterBar, networkLogColumnsVisibilitySetting, true);
    this._networkLogView.show(this._splitView.sidebarElement());

    var viewsContainerView = new WebInspector.VBox();
    this._viewsContainerElement = viewsContainerView.element;
    this._viewsContainerElement.id = "imported-network-views";
    if (!this._networkLogView.useLargeRows)
        this._viewsContainerElement.classList.add("small");
    viewsContainerView.show(this._splitView.mainElement());

    this._networkLogView.addEventListener(WebInspector.NetworkLogView.EventTypes.ViewCleared, this._onViewCleared, this);
    this._networkLogView.addEventListener(WebInspector.NetworkLogView.EventTypes.RowSizeChanged, this._onRowSizeChanged, this);
    this._networkLogView.addEventListener(WebInspector.NetworkLogView.EventTypes.RequestSelected, this._onRequestSelected, this);
    this._networkLogView.addEventListener(WebInspector.NetworkLogView.EventTypes.SearchCountUpdated, this._onSearchCountUpdated, this);
    this._networkLogView.addEventListener(WebInspector.NetworkLogView.EventTypes.SearchIndexUpdated, this._onSearchIndexUpdated, this);

    this._closeButtonElement = this._viewsContainerElement.createChild("div", "close-button");
    this._closeButtonElement.id = "imported-network-close-button";
    this._closeButtonElement.addEventListener("click", this._toggleGridMode.bind(this), false);
    this._viewsContainerElement.appendChild(this._closeButtonElement);

    for (var i = 0; i < this._networkLogView.statusBarItems.length; ++i)
        this._panelStatusBarElement.appendChild(this._networkLogView.statusBarItems[i]);

    /**
     * @this {WebInspector.ImportedNetworkPanel}
     * @return {?WebInspector.SourceFrame}
     */
    function sourceFrameGetter()
    {
        return this._networkItemView.currentSourceFrame();
    }
    WebInspector.GoToLineDialog.install(this, sourceFrameGetter.bind(this));
}

/** @enum {string} */
WebInspector.ImportedNetworkPanel.FilterType = {
    Domain: "Domain",
    HasResponseHeader: "HasResponseHeader",
    Method: "Method",
    MimeType: "MimeType",
    SetCookieDomain: "SetCookieDomain",
    SetCookieName: "SetCookieName",
    SetCookieValue: "SetCookieValue",
    StatusCode: "StatusCode"
};

/** @type {!Array.<string>} */
WebInspector.ImportedNetworkPanel._searchKeys = Object.values(WebInspector.ImportedNetworkPanel.FilterType);

WebInspector.ImportedNetworkPanel.prototype = {
    _onFiltersToggled: function(event)
    {
        var toggled = /** @type {boolean} */ (event.data);
        this._filtersContainer.classList.toggle("hidden", !toggled);
        this.element.classList.toggle("filters-toggled", toggled);
        this.doResize();
    },

    /**
     * @return {!Array.<!Element>}
     */
    elementsToRestoreScrollPositionsFor: function()
    {
        return this._networkLogView.elementsToRestoreScrollPositionsFor();
    },

    /**
     * @return {!WebInspector.SearchableView}
     */
    searchableView: function()
    {
        return this._searchableView;
    },

    // FIXME: only used by the layout tests, should not be exposed.
    _reset: function()
    {
        this._networkLogView._reset();
    },

    handleShortcut: function(event)
    {
        if (this._viewingRequestMode && event.keyCode === WebInspector.KeyboardShortcut.Keys.Esc.code) {
            this._toggleGridMode();
            event.handled = true;
            return;
        }

        WebInspector.Panel.prototype.handleShortcut.call(this, event);
    },

    wasShown: function()
    {
        WebInspector.Panel.prototype.wasShown.call(this);
    },

    get requests()
    {
        return this._networkLogView.requests;
    },

    /**
     * @param {!WebInspector.NetworkRequest} request
     */
    revealAndHighlightRequest: function(request)
    {
        this._toggleGridMode();
        if (request)
            this._networkLogView.revealAndHighlightRequest(request);
    },

    _onViewCleared: function(event)
    {
        this._closeVisibleRequest();
        this._toggleGridMode();
        this._viewsContainerElement.removeChildren();
        this._viewsContainerElement.appendChild(this._closeButtonElement);
    },

    _onRowSizeChanged: function(event)
    {
        this._viewsContainerElement.classList.toggle("small", !event.data.largeRows);
    },

    _onSearchCountUpdated: function(event)
    {
        this._searchableView.updateSearchMatchesCount(event.data);
    },

    _onSearchIndexUpdated: function(event)
    {
        this._searchableView.updateCurrentMatchIndex(event.data);
    },

    _onRequestSelected: function(event)
    {
        this._showRequest(event.data);
    },

    /**
     * @param {?WebInspector.NetworkRequest} request
     */
    _showRequest: function(request)
    {
        if (!request)
            return;

        this._toggleViewingRequestMode();

        if (this._networkItemView) {
            this._networkItemView.detach();
            delete this._networkItemView;
        }

        var view = new WebInspector.NetworkItemView(request);
        view.show(this._viewsContainerElement);
        this._networkItemView = view;
    },

    _closeVisibleRequest: function()
    {
        this.element.classList.remove("viewing-resource");

        if (this._networkItemView) {
            this._networkItemView.detach();
            delete this._networkItemView;
        }
    },

    _toggleGridMode: function()
    {
        if (this._viewingRequestMode) {
            this._viewingRequestMode = false;
            this.element.classList.remove("viewing-resource");
            this._splitView.hideMain();
        }

        this._networkLogView.switchToDetailedView();
        this._networkLogView.allowPopover = true;
        this._networkLogView._allowRequestSelection = false;
    },

    _toggleViewingRequestMode: function()
    {
        if (this._viewingRequestMode)
            return;
        this._viewingRequestMode = true;

        this.element.classList.add("viewing-resource");
        this._splitView.showBoth();
        this._networkLogView.allowPopover = false;
        this._networkLogView._allowRequestSelection = true;
        this._networkLogView.switchToBriefView();
    },

    /**
     * @param {string} query
     * @param {boolean} shouldJump
     * @param {boolean=} jumpBackwards
     */
    performSearch: function(query, shouldJump, jumpBackwards)
    {
        this._networkLogView.performSearch(query, shouldJump, jumpBackwards);
    },

    jumpToPreviousSearchResult: function()
    {
        this._networkLogView.jumpToPreviousSearchResult();
    },

    jumpToNextSearchResult: function()
    {
        this._networkLogView.jumpToNextSearchResult();
    },

    searchCanceled: function()
    {
        this._networkLogView.searchCanceled();
    },

    /**
     * @param {!WebInspector.ContextMenu} contextMenu
     * @param {!Object} target
     * @this {WebInspector.ImportedNetworkPanel}
     */
    appendApplicableItems: function(event, contextMenu, target)
    {
        /**
         * @this {WebInspector.ImportedNetworkPanel}
         */
        function reveal(request)
        {
            WebInspector.inspectorView.setCurrentPanel(this);
            this.revealAndHighlightRequest(request);
        }

        /**
         * @this {WebInspector.ImportedNetworkPanel}
         */
        function appendRevealItem(request)
        {
            var revealText = WebInspector.UIString(WebInspector.useLowerCaseMenuTitles() ? "Reveal in Network panel" : "Reveal in Network Panel");
            contextMenu.appendItem(revealText, reveal.bind(this, request));
        }

        if (target instanceof WebInspector.Resource) {
            var resource = /** @type {!WebInspector.Resource} */ (target);
            if (resource.request)
                appendRevealItem.call(this, resource.request);
            return;
        }
        if (target instanceof WebInspector.UISourceCode) {
            var uiSourceCode = /** @type {!WebInspector.UISourceCode} */ (target);
            var resource = WebInspector.resourceForURL(uiSourceCode.url);
            if (resource && resource.request)
                appendRevealItem.call(this, resource.request);
            return;
        }

        if (!(target instanceof WebInspector.NetworkRequest))
            return;
        var request = /** @type {!WebInspector.NetworkRequest} */ (target);
        if (this._networkItemView && this._networkItemView.isShowing() && this._networkItemView.request() === request)
            return;

        appendRevealItem.call(this, request);
    },

    _injectStyles: function()
    {
        var style = document.createElement("style");
        var rules = [];

        var columns = WebInspector.NetworkLogView._defaultColumnsVisibility;

        var hideSelectors = [];
        var bgSelectors = [];
        for (var columnId in columns) {
            hideSelectors.push("#network-container .hide-" + columnId + "-column ." + columnId + "-column");
            bgSelectors.push(".network-log-grid.data-grid td." + columnId + "-column");
        }
        rules.push(hideSelectors.join(", ") + "{border-left: 0 none transparent;}");
        rules.push(bgSelectors.join(", ") + "{background-color: rgba(0, 0, 0, 0.07);}");

        style.textContent = rules.join("\n");
        document.head.appendChild(style);
    },

    __proto__: WebInspector.Panel.prototype
}

/**
 * @constructor
 * @implements {WebInspector.ContextMenu.Provider}
 */
WebInspector.ImportedNetworkPanel.ContextMenuProvider = function()
{
}

WebInspector.ImportedNetworkPanel.ContextMenuProvider.prototype = {
    /**
     * @param {!WebInspector.ContextMenu} contextMenu
     * @param {!Object} target
     */
    appendApplicableItems: function(event, contextMenu, target)
    {
        WebInspector.inspectorView.panel("network").appendApplicableItems(event, contextMenu, target);
    }
}

/**
 * @constructor
 * @implements {WebInspector.Revealer}
 */
WebInspector.ImportedNetworkPanel.RequestRevealer = function()
{
}

WebInspector.ImportedNetworkPanel.RequestRevealer.prototype = {
    /**
     * @param {!Object} request
     */
    reveal: function(request)
    {
        if (request instanceof WebInspector.NetworkRequest)
            /** @type {!WebInspector.ImportedNetworkPanel} */ (WebInspector.inspectorView.showPanel("importednetwork")).revealAndHighlightRequest(request);
    }
}

