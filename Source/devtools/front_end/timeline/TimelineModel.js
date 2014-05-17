/*
 * Copyright (C) 2012 Google Inc. All rights reserved.
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
 * @extends {WebInspector.Object}
 * @param {!WebInspector.TimelineManager} timelineManager
 */
WebInspector.TimelineModel = function(timelineManager)
{
    this._timelineManager = timelineManager;
    this._filters = [];
    this._bindings = new WebInspector.TimelineModel.InterRecordBindings();

    this.reset();

    this._timelineManager.addEventListener(WebInspector.TimelineManager.EventTypes.TimelineEventRecorded, this._onRecordAdded, this);
    this._timelineManager.addEventListener(WebInspector.TimelineManager.EventTypes.TimelineStarted, this._onStarted, this);
    this._timelineManager.addEventListener(WebInspector.TimelineManager.EventTypes.TimelineStopped, this._onStopped, this);
    this._timelineManager.addEventListener(WebInspector.TimelineManager.EventTypes.TimelineProgress, this._onProgress, this);
}

WebInspector.TimelineModel.TransferChunkLengthBytes = 5000000;

WebInspector.TimelineModel.RecordType = {
    Root: "Root",
    Program: "Program",
    EventDispatch: "EventDispatch",

    GPUTask: "GPUTask",

    RequestMainThreadFrame: "RequestMainThreadFrame",
    BeginFrame: "BeginFrame",
    ActivateLayerTree: "ActivateLayerTree",
    DrawFrame: "DrawFrame",
    ScheduleStyleRecalculation: "ScheduleStyleRecalculation",
    RecalculateStyles: "RecalculateStyles",
    InvalidateLayout: "InvalidateLayout",
    Layout: "Layout",
    UpdateLayerTree: "UpdateLayerTree",
    PaintSetup: "PaintSetup",
    Paint: "Paint",
    Rasterize: "Rasterize",
    ScrollLayer: "ScrollLayer",
    DecodeImage: "DecodeImage",
    ResizeImage: "ResizeImage",
    CompositeLayers: "CompositeLayers",

    ParseHTML: "ParseHTML",

    TimerInstall: "TimerInstall",
    TimerRemove: "TimerRemove",
    TimerFire: "TimerFire",

    XHRReadyStateChange: "XHRReadyStateChange",
    XHRLoad: "XHRLoad",
    EvaluateScript: "EvaluateScript",

    MarkLoad: "MarkLoad",
    MarkDOMContent: "MarkDOMContent",
    MarkFirstPaint: "MarkFirstPaint",

    TimeStamp: "TimeStamp",
    ConsoleTime: "ConsoleTime",

    ResourceSendRequest: "ResourceSendRequest",
    ResourceReceiveResponse: "ResourceReceiveResponse",
    ResourceReceivedData: "ResourceReceivedData",
    ResourceFinish: "ResourceFinish",

    FunctionCall: "FunctionCall",
    GCEvent: "GCEvent",
    JSFrame: "JSFrame",

    UpdateCounters: "UpdateCounters",

    RequestAnimationFrame: "RequestAnimationFrame",
    CancelAnimationFrame: "CancelAnimationFrame",
    FireAnimationFrame: "FireAnimationFrame",

    WebSocketCreate : "WebSocketCreate",
    WebSocketSendHandshakeRequest : "WebSocketSendHandshakeRequest",
    WebSocketReceiveHandshakeResponse : "WebSocketReceiveHandshakeResponse",
    WebSocketDestroy : "WebSocketDestroy",

    EmbedderCallback : "EmbedderCallback",
}

WebInspector.TimelineModel.Events = {
    RecordAdded: "RecordAdded",
    RecordsCleared: "RecordsCleared",
    RecordingStarted: "RecordingStarted",
    RecordingStopped: "RecordingStopped",
    RecordingProgress: "RecordingProgress",
    RecordFilterChanged: "RecordFilterChanged"
}

/**
 * @param {!Array.<!WebInspector.TimelineModel.Record>} recordsArray
 * @param {?function(!WebInspector.TimelineModel.Record)|?function(!WebInspector.TimelineModel.Record,number)} preOrderCallback
 * @param {function(!WebInspector.TimelineModel.Record)|function(!WebInspector.TimelineModel.Record,number)=} postOrderCallback
 * @return {boolean}
 */
WebInspector.TimelineModel.forAllRecords = function(recordsArray, preOrderCallback, postOrderCallback)
{
    /**
     * @param {!Array.<!WebInspector.TimelineModel.Record>} records
     * @param {number} depth
     * @return {boolean}
     */
    function processRecords(records, depth)
    {
        for (var i = 0; i < records.length; ++i) {
            var record = records[i];
            if (preOrderCallback && preOrderCallback(record, depth))
                return true;
            if (processRecords(record.children(), depth + 1))
                return true;
            if (postOrderCallback && postOrderCallback(record, depth))
                return true;
        }
        return false;
    }
    return processRecords(recordsArray, 0);
}

WebInspector.TimelineModel.prototype = {
    /**
     * @return {!WebInspector.Target}
     */
    target: function()
    {
        return this._timelineManager.target();
    },

    /**
     * @return {boolean}
     */
    loadedFromFile: function()
    {
        return this._loadedFromFile;
    },

    /**
     * @param {?function(!WebInspector.TimelineModel.Record)|?function(!WebInspector.TimelineModel.Record,number)} preOrderCallback
     * @param {function(!WebInspector.TimelineModel.Record)|function(!WebInspector.TimelineModel.Record,number)=} postOrderCallback
     */
    forAllRecords: function(preOrderCallback, postOrderCallback)
    {
        WebInspector.TimelineModel.forAllRecords(this._records, preOrderCallback, postOrderCallback);
    },

    /**
     * @param {!WebInspector.TimelineModel.Filter} filter
     */
    addFilter: function(filter)
    {
        this._filters.push(filter);
        filter._model = this;
    },

    /**
     * @param {function(!WebInspector.TimelineModel.Record)|function(!WebInspector.TimelineModel.Record,number)} callback
     */
    forAllFilteredRecords: function(callback)
    {
        /**
         * @param {!WebInspector.TimelineModel.Record} record
         * @param {number} depth
         * @this {WebInspector.TimelineModel}
         * @return {boolean}
         */
        function processRecord(record, depth)
        {
            var visible = this.isVisible(record);
            if (visible) {
                if (callback(record, depth))
                    return true;
            }

            for (var i = 0; i < record.children().length; ++i) {
                if (processRecord.call(this, record.children()[i], visible ? depth + 1 : depth))
                    return true;
            }
            return false;
        }

        for (var i = 0; i < this._records.length; ++i)
            processRecord.call(this, this._records[i], 0);
    },

    /**
     * @param {!WebInspector.TimelineModel.Record} record
     * @return {boolean}
     */
    isVisible: function(record)
    {
        for (var i = 0; i < this._filters.length; ++i) {
            if (!this._filters[i].accept(record))
                return false;
        }
        return true;
    },

    _filterChanged: function()
    {
        this.dispatchEventToListeners(WebInspector.TimelineModel.Events.RecordFilterChanged);
    },

    /**
     * @param {boolean} captureStacks
     * @param {boolean} captureMemory
     */
    startRecording: function(captureStacks, captureMemory)
    {
        this._clientInitiatedRecording = true;
        this.reset();
        var maxStackFrames = captureStacks ? 30 : 0;
        this._bufferEvents = WebInspector.experimentsSettings.timelineNoLiveUpdate.isEnabled();
        var includeGPUEvents = WebInspector.experimentsSettings.gpuTimeline.isEnabled();
        var liveEvents = [ WebInspector.TimelineModel.RecordType.BeginFrame,
                           WebInspector.TimelineModel.RecordType.DrawFrame,
                           WebInspector.TimelineModel.RecordType.RequestMainThreadFrame,
                           WebInspector.TimelineModel.RecordType.ActivateLayerTree ];
        this._timelineManager.start(maxStackFrames, this._bufferEvents, liveEvents.join(","), captureMemory, includeGPUEvents, this._fireRecordingStarted.bind(this));
    },

    stopRecording: function()
    {
        if (!this._clientInitiatedRecording) {
            this._timelineManager.start(undefined, undefined, undefined, undefined, undefined, stopTimeline.bind(this));
            return;
        }

        /**
         * Console started this one and we are just sniffing it. Initiate recording so that we
         * could stop it.
         * @this {WebInspector.TimelineModel}
         */
        function stopTimeline()
        {
            this._timelineManager.stop(this._fireRecordingStopped.bind(this));
        }

        this._clientInitiatedRecording = false;
        this._timelineManager.stop(this._fireRecordingStopped.bind(this));
    },

    /**
     * @return {!Array.<!WebInspector.TimelineModel.Record>}
     */
    records: function()
    {
        return this._records;
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _onRecordAdded: function(event)
    {
        if (this._collectionEnabled)
            this._addRecord(/** @type {!TimelineAgent.TimelineEvent} */(event.data));
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _onStarted: function(event)
    {
        if (event.data) {
            // Started from console.
            this._fireRecordingStarted();
        }
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _onStopped: function(event)
    {
        if (event.data) {
            // Stopped from console.
            this._fireRecordingStopped(null, null);
        }
    },

    /**
     * @param {!WebInspector.Event} event
     */
    _onProgress: function(event)
    {
        this.dispatchEventToListeners(WebInspector.TimelineModel.Events.RecordingProgress, event.data);
    },

    _fireRecordingStarted: function()
    {
        this._collectionEnabled = true;
        this.dispatchEventToListeners(WebInspector.TimelineModel.Events.RecordingStarted);
    },

    /**
     * @param {?Protocol.Error} error
     * @param {?ProfilerAgent.CPUProfile} cpuProfile
     */
    _fireRecordingStopped: function(error, cpuProfile)
    {
        this._bufferEvents = false;
        this._collectionEnabled = false;
        if (cpuProfile)
            WebInspector.TimelineJSProfileProcessor.mergeJSProfileIntoTimeline(this, cpuProfile);
        this.dispatchEventToListeners(WebInspector.TimelineModel.Events.RecordingStopped);
    },

    /**
     * @return {boolean}
     */
    bufferEvents: function()
    {
        return this._bufferEvents;
    },

    /**
     * @param {!TimelineAgent.TimelineEvent} payload
     */
    _addRecord: function(payload)
    {
        this._internStrings(payload);
        this._payloads.push(payload);
        this._updateBoundaries(payload);

        var record = this._innerAddRecord(payload, null);
        this._records.push(record);
        if (record.type() === WebInspector.TimelineModel.RecordType.Program)
            this._mainThreadTasks.push(record);
        if (record.type() === WebInspector.TimelineModel.RecordType.GPUTask)
            this._gpuThreadTasks.push(record);

        this.dispatchEventToListeners(WebInspector.TimelineModel.Events.RecordAdded, record);
    },

    /**
     * @param {!TimelineAgent.TimelineEvent} payload
     * @param {?WebInspector.TimelineModel.Record} parentRecord
     * @return {!WebInspector.TimelineModel.Record}
     * @this {!WebInspector.TimelineModel}
     */
    _innerAddRecord: function(payload, parentRecord)
    {
        var record = new WebInspector.TimelineModel.RecordImpl(this, payload, parentRecord);
        if (WebInspector.TimelineUIUtils.isEventDivider(record))
            this._eventDividerRecords.push(record);

        for (var i = 0; payload.children && i < payload.children.length; ++i)
            this._innerAddRecord.call(this, payload.children[i], record);

        record._calculateAggregatedStats();
        if (parentRecord)
            parentRecord._selfTime -= record.endTime() - record.startTime();
        return record;
    },

    /**
     * @param {!Blob} file
     * @param {!WebInspector.Progress} progress
     */
    loadFromFile: function(file, progress)
    {
        var delegate = new WebInspector.TimelineModelLoadFromFileDelegate(this, progress);
        var fileReader = this._createFileReader(file, delegate);
        var loader = new WebInspector.TimelineModelLoader(this, fileReader, progress);
        fileReader.start(loader);
    },

    /**
     * @param {string} url
     */
    loadFromURL: function(url, progress)
    {
        var delegate = new WebInspector.TimelineModelLoadFromFileDelegate(this, progress);
        var urlReader = new WebInspector.ChunkedXHRReader(url, delegate);
        var loader = new WebInspector.TimelineModelLoader(this, urlReader, progress);
        urlReader.start(loader);
    },

    _createFileReader: function(file, delegate)
    {
        return new WebInspector.ChunkedFileReader(file, WebInspector.TimelineModel.TransferChunkLengthBytes, delegate);
    },

    _createFileWriter: function()
    {
        return new WebInspector.FileOutputStream();
    },

    saveToFile: function()
    {
        var now = new Date();
        var fileName = "TimelineRawData-" + now.toISO8601Compact() + ".json";
        var stream = this._createFileWriter();

        /**
         * @param {boolean} accepted
         * @this {WebInspector.TimelineModel}
         */
        function callback(accepted)
        {
            if (!accepted)
                return;
            var saver = new WebInspector.TimelineSaver(stream);
            saver.save(this._payloads, window.navigator.appVersion);
        }
        stream.open(fileName, callback.bind(this));
    },

    reset: function()
    {
        this._loadedFromFile = false;
        this._records = [];
        this._payloads = [];
        this._stringPool = {};
        this._minimumRecordTime = -1;
        this._maximumRecordTime = -1;
        this._bindings._reset();
        /** @type {!Array.<!WebInspector.TimelineModel.Record>} */
        this._mainThreadTasks =  [];
        /** @type {!Array.<!WebInspector.TimelineModel.Record>} */
        this._gpuThreadTasks = [];
        /** @type {!Array.<!WebInspector.TimelineModel.Record>} */
        this._eventDividerRecords = [];
        this.dispatchEventToListeners(WebInspector.TimelineModel.Events.RecordsCleared);
    },

    /**
     * @return {number}
     */
    minimumRecordTime: function()
    {
        return this._minimumRecordTime;
    },

    /**
     * @return {number}
     */
    maximumRecordTime: function()
    {
        return this._maximumRecordTime;
    },

    /**
     * @param {!TimelineAgent.TimelineEvent} record
     */
    _updateBoundaries: function(record)
    {
        var startTime = record.startTime;
        var endTime = record.endTime;

        if (this._minimumRecordTime === -1 || startTime < this._minimumRecordTime)
            this._minimumRecordTime = startTime;
        if ((this._maximumRecordTime === -1 && endTime) || endTime > this._maximumRecordTime)
            this._maximumRecordTime = endTime;
    },

    /**
     * @return {!Array.<!WebInspector.TimelineModel.Record>}
     */
    mainThreadTasks: function()
    {
        return this._mainThreadTasks;
    },

    /**
     * @return {!Array.<!WebInspector.TimelineModel.Record>}
     */
    gpuThreadTasks: function()
    {
        return this._gpuThreadTasks;
    },

    /**
     * @return {!Array.<!WebInspector.TimelineModel.Record>}
     */
    eventDividerRecords: function()
    {
        return this._eventDividerRecords;
    },

    /**
     * @param {!TimelineAgent.TimelineEvent} record
     */
    _internStrings: function(record)
    {
        for (var name in record) {
            var value = record[name];
            if (typeof value !== "string")
                continue;

            var interned = this._stringPool[value];
            if (typeof interned === "string")
                record[name] = interned;
            else
                this._stringPool[value] = value;
        }

        var children = record.children;
        for (var i = 0; children && i < children.length; ++i)
            this._internStrings(children[i]);
    },

    __proto__: WebInspector.Object.prototype
}


/**
 * @constructor
 */
WebInspector.TimelineModel.InterRecordBindings = function() {
    this._reset();
}

WebInspector.TimelineModel.InterRecordBindings.prototype = {
    _reset: function()
    {
        this._sendRequestRecords = {};
        this._timerRecords = {};
        this._requestAnimationFrameRecords = {};
        this._layoutInvalidate = {};
        this._lastScheduleStyleRecalculation = {};
        this._webSocketCreateRecords = {};
    }
}

/**
 * @interface
 */
WebInspector.TimelineModel.Record = function()
{
}

WebInspector.TimelineModel.Record.prototype = {
    /**
     * @return {?string}
     */
    url: function() { },

    /**
     * @return {?Array.<!ConsoleAgent.CallFrame>}
     */
    callSiteStackTrace: function() { },

    /**
     * @return {?WebInspector.TimelineModel.Record}
     */
    initiator: function() { },

    /**
     * @return {!WebInspector.Target}
     */
    target: function() { },

    /**
     * @return {number}
     */
    selfTime: function() { },

    /**
     * @return {!Array.<!WebInspector.TimelineModel.Record>}
     */
    children: function() { },

    /**
     * @return {!WebInspector.TimelineCategory}
     */
    category: function() { },

    /**
     * @return {string}
     */
    title: function() { },

    /**
     * @return {number}
     */
    startTime: function() { },

    /**
     * @return {string|undefined}
     */
    thread: function() { },

    /**
     * @return {number}
     */
    endTime: function() { },

    /**
     * @param {number} endTime
     */
    setEndTime: function(endTime) { },

    /**
     * @return {!Object}
     */
    data: function() { },

    /**
     * @return {string}
     */
    type: function() { },

    /**
     * @return {string}
     */
    frameId: function() { },

    /**
     * @return {?Array.<!ConsoleAgent.CallFrame>}
     */
    stackTrace: function() { },

    /**
     * @param {string} key
     * @return {?Object}
     */
    getUserObject: function(key) { },

    /**
     * @param {string} key
     * @param {?Object|undefined} value
     */
    setUserObject: function(key, value) { },

    /**
     * @return {!Object.<string, number>}
     */
    aggregatedStats: function() { },

    /**
     * @return {?Array.<string>}
     */
    warnings: function() { },

    /**
     * @return {boolean}
     */
    childHasWarnings: function() { },

    /**
     * @param {!RegExp} regExp
     * @return {boolean}
     */
    testContentMatching: function(regExp) { }
}

/**
 * @constructor
 * @implements {WebInspector.TimelineModel.Record}
 * @param {!WebInspector.TimelineModel} model
 * @param {!TimelineAgent.TimelineEvent} timelineEvent
 * @param {?WebInspector.TimelineModel.Record} parentRecord
 */
WebInspector.TimelineModel.RecordImpl = function(model, timelineEvent, parentRecord)
{
    this._model = model;
    var bindings = this._model._bindings;
    this._aggregatedStats = {};
    this._record = timelineEvent;
    this._children = [];
    if (parentRecord) {
        this.parent = parentRecord;
        parentRecord.children().push(this);
    }

    this._selfTime = this.endTime() - this.startTime();

    if (parentRecord && parentRecord.callSiteStackTrace())
        this._callSiteStackTrace = parentRecord.callSiteStackTrace();

    var recordTypes = WebInspector.TimelineModel.RecordType;
    switch (timelineEvent.type) {
    case recordTypes.ResourceSendRequest:
        // Make resource receive record last since request was sent; make finish record last since response received.
        bindings._sendRequestRecords[timelineEvent.data["requestId"]] = this;
        break;

    case recordTypes.ResourceReceiveResponse:
    case recordTypes.ResourceReceivedData:
    case recordTypes.ResourceFinish:
        this._initiator = bindings._sendRequestRecords[timelineEvent.data["requestId"]];
        break;

    case recordTypes.TimerInstall:
        bindings._timerRecords[timelineEvent.data["timerId"]] = this;
        break;

    case recordTypes.TimerFire:
        this._initiator = bindings._timerRecords[timelineEvent.data["timerId"]];
        break;

    case recordTypes.RequestAnimationFrame:
        bindings._requestAnimationFrameRecords[timelineEvent.data["id"]] = this;
        break;

    case recordTypes.FireAnimationFrame:
        this._initiator = bindings._requestAnimationFrameRecords[timelineEvent.data["id"]];
        break;

    case recordTypes.ScheduleStyleRecalculation:
        bindings._lastScheduleStyleRecalculation[this.frameId()] = this;
        break;

    case recordTypes.RecalculateStyles:
        this._initiator = bindings._lastScheduleStyleRecalculation[this.frameId()];
        break;

    case recordTypes.InvalidateLayout:
        // Consider style recalculation as a reason for layout invalidation,
        // but only if we had no earlier layout invalidation records.
        var initiator = this;
        if (!bindings._layoutInvalidate[this.frameId()] && parentRecord.type() === recordTypes.RecalculateStyles)
            initiator = parentRecord;
        bindings._layoutInvalidate[this.frameId()] = initiator;
        break;

    case recordTypes.Layout:
        this._initiator = bindings._layoutInvalidate[this.frameId()];
        if (this._initiator)
            this._callSiteStackTrace = this._initiator.callSiteStackTrace()
        if (this.stackTrace())
            this._addWarning(WebInspector.UIString("Forced synchronous layout is a possible performance bottleneck."));

        bindings._layoutInvalidate[this.frameId()] = null;
        this.highlightQuad = timelineEvent.data.root || WebInspector.TimelineModel._quadFromRectData(timelineEvent.data);
        break;

    case recordTypes.Paint:
        this.highlightQuad = timelineEvent.data.clip || WebInspector.TimelineModel._quadFromRectData(timelineEvent.data);
        break;

    case recordTypes.WebSocketCreate:
        bindings._webSocketCreateRecords[timelineEvent.data["identifier"]] = this;
        break;

    case recordTypes.WebSocketSendHandshakeRequest:
    case recordTypes.WebSocketReceiveHandshakeResponse:
    case recordTypes.WebSocketDestroy:
        this._initiator = bindings._webSocketCreateRecords[timelineEvent.data["identifier"]];
        break;

    case recordTypes.EmbedderCallback:
        this.embedderCallbackName = timelineEvent.data["callbackName"];
        break;
    }
}

WebInspector.TimelineModel.RecordImpl.prototype = {
    /**
     * @return {?string}
     */
    url: function()
    {
        var data = this.data();
        if (data && data["url"])
            return data["url"];
        if (this._initiator)
            return this._initiator.url();
        return null;
    },

    /**
     * @return {?Array.<!ConsoleAgent.CallFrame>}
     */
    callSiteStackTrace: function()
    {
        if (this._callSiteStackTrace)
            return this._callSiteStackTrace;
        return this._initiator ? this._initiator.stackTrace() : null;
    },

    /**
     * @return {?WebInspector.TimelineModel.Record}
     */
    initiator: function()
    {
        return this._initiator;
    },

    /**
     * @return {!WebInspector.Target}
     */
    target: function()
    {
        return this._model.target();
    },

    /**
     * @return {number}
     */
    selfTime: function()
    {
        return this._selfTime;
    },

    /**
     * @return {!Array.<!WebInspector.TimelineModel.Record>}
     */
    children: function()
    {
        return this._children;
    },

    /**
     * @return {!WebInspector.TimelineCategory}
     */
    category: function()
    {
        return WebInspector.TimelineUIUtils.categoryForRecord(this);
    },

    /**
     * @return {string}
     */
    title: function()
    {
        return WebInspector.TimelineUIUtils.recordTitle(this, this._model);
    },

    /**
     * @return {number}
     */
    startTime: function()
    {
        return this._record.startTime;
    },

    /**
     * @return {string|undefined}
     */
    thread: function()
    {
        return this._record.thread;
    },

    /**
     * @return {number}
     */
    endTime: function()
    {
        return this._endTime || this._record.endTime || this._record.startTime;
    },

    /**
     * @param {number} endTime
     */
    setEndTime: function(endTime)
    {
        this._endTime = endTime;
    },

    /**
     * @return {!Object}
     */
    data: function()
    {
        return this._record.data;
    },

    /**
     * @return {string}
     */
    type: function()
    {
        return this._record.type;
    },

    /**
     * @return {string}
     */
    frameId: function()
    {
        return this._record.frameId || "";
    },

    /**
     * @return {?Array.<!ConsoleAgent.CallFrame>}
     */
    stackTrace: function()
    {
        if (this._record.stackTrace && this._record.stackTrace.length)
            return this._record.stackTrace;
        return null;
    },

    /**
     * @param {string} key
     * @return {?Object}
     */
    getUserObject: function(key)
    {
        if (!this._userObjects)
            return null;
        return this._userObjects.get(key);
    },

    /**
     * @param {string} key
     * @param {?Object|undefined} value
     */
    setUserObject: function(key, value)
    {
        if (!this._userObjects)
            this._userObjects = new StringMap();
        this._userObjects.put(key, value);
    },

    _calculateAggregatedStats: function()
    {
        this._aggregatedStats = {};

        for (var index = this._children.length; index; --index) {
            var child = this._children[index - 1];
            for (var category in child._aggregatedStats)
                this._aggregatedStats[category] = (this._aggregatedStats[category] || 0) + child._aggregatedStats[category];
        }
        this._aggregatedStats[this.category().name] = (this._aggregatedStats[this.category().name] || 0) + this._selfTime;
    },

    /**
     * @return {!Object.<string, number>}
     */
    aggregatedStats: function()
    {
        return this._aggregatedStats;
    },

    /**
     * @param {string} message
     */
    _addWarning: function(message)
    {
        if (this._warnings)
            this._warnings.push(message);
        else {
            this._warnings = [message];
            for (var parent = this.parent; parent && !parent._childHasWarnings; parent = parent.parent)
                parent._childHasWarnings = true;
        }
    },

    /**
     * @return {?Array.<string>}
     */
    warnings: function()
    {
        return this._warnings;
    },

    /**
     * @return {boolean}
     */
    childHasWarnings: function()
    {
        return !!this._childHasWarnings;
    },

    /**
     * @param {!RegExp} regExp
     * @return {boolean}
     */
    testContentMatching: function(regExp)
    {
        var tokens = [this.title()];
        for (var key in this._record.data)
            tokens.push(this._record.data[key])
        return regExp.test(tokens.join("|"));
    }
}

/**
 * @constructor
 */
WebInspector.TimelineModel.Filter = function()
{
    /** @type {!WebInspector.TimelineModel} */
    this._model;
}

WebInspector.TimelineModel.Filter.prototype = {
    /**
     * @param {!WebInspector.TimelineModel.Record} record
     * @return {boolean}
     */
    accept: function(record)
    {
        return true;
    },

    notifyFilterChanged: function()
    {
        this._model._filterChanged();
    }
}

/**
 * @constructor
 * @implements {WebInspector.OutputStream}
 * @param {!WebInspector.TimelineModel} model
 * @param {!{cancel: function()}} reader
 * @param {!WebInspector.Progress} progress
 */
WebInspector.TimelineModelLoader = function(model, reader, progress)
{
    this._model = model;
    this._reader = reader;
    this._progress = progress;
    this._buffer = "";
    this._firstChunk = true;
}

WebInspector.TimelineModelLoader.prototype = {
    /**
     * @param {string} chunk
     */
    write: function(chunk)
    {
        var data = this._buffer + chunk;
        var lastIndex = 0;
        var index;
        do {
            index = lastIndex;
            lastIndex = WebInspector.TextUtils.findBalancedCurlyBrackets(data, index);
        } while (lastIndex !== -1)

        var json = data.slice(0, index) + "]";
        this._buffer = data.slice(index);

        if (!index)
            return;

        // Prepending "0" to turn string into valid JSON.
        if (!this._firstChunk)
            json = "[0" + json;

        var items;
        try {
            items = /** @type {!Array.<!TimelineAgent.TimelineEvent>} */ (JSON.parse(json));
        } catch (e) {
            WebInspector.console.showErrorMessage("Malformed timeline data.");
            this._model.reset();
            this._reader.cancel();
            this._progress.done();
            return;
        }

        if (this._firstChunk) {
            this._version = items[0];
            this._firstChunk = false;
            this._model.reset();
        }

        // Skip 0-th element - it is either version or 0.
        for (var i = 1, size = items.length; i < size; ++i)
            this._model._addRecord(items[i]);
    },

    close: function()
    {
        this._model._loadedFromFile = true;
    }
}

/**
 * @constructor
 * @implements {WebInspector.OutputStreamDelegate}
 * @param {!WebInspector.TimelineModel} model
 * @param {!WebInspector.Progress} progress
 */
WebInspector.TimelineModelLoadFromFileDelegate = function(model, progress)
{
    this._model = model;
    this._progress = progress;
}

WebInspector.TimelineModelLoadFromFileDelegate.prototype = {
    onTransferStarted: function()
    {
        this._progress.setTitle(WebInspector.UIString("Loading\u2026"));
    },

    /**
     * @param {!WebInspector.ChunkedReader} reader
     */
    onChunkTransferred: function(reader)
    {
        if (this._progress.isCanceled()) {
            reader.cancel();
            this._progress.done();
            this._model.reset();
            return;
        }

        var totalSize = reader.fileSize();
        if (totalSize) {
            this._progress.setTotalWork(totalSize);
            this._progress.setWorked(reader.loadedSize());
        }
    },

    onTransferFinished: function()
    {
        this._progress.done();
    },

    /**
     * @param {!WebInspector.ChunkedReader} reader
     */
    onError: function(reader, event)
    {
        this._progress.done();
        this._model.reset();
        switch (event.target.error.code) {
        case FileError.NOT_FOUND_ERR:
            WebInspector.console.showErrorMessage(WebInspector.UIString("File \"%s\" not found.", reader.fileName()));
            break;
        case FileError.NOT_READABLE_ERR:
            WebInspector.console.showErrorMessage(WebInspector.UIString("File \"%s\" is not readable", reader.fileName()));
            break;
        case FileError.ABORT_ERR:
            break;
        default:
            WebInspector.console.showErrorMessage(WebInspector.UIString("An error occurred while reading the file \"%s\"", reader.fileName()));
        }
    }
}

/**
 * @constructor
 */
WebInspector.TimelineSaver = function(stream)
{
    this._stream = stream;
}

WebInspector.TimelineSaver.prototype = {
    /**
     * @param {!Array.<*>} payloads
     * @param {string} version
     */
    save: function(payloads, version)
    {
        this._payloads = payloads;
        this._recordIndex = 0;
        this._prologue = "[" + JSON.stringify(version);

        this._writeNextChunk(this._stream);
    },

    _writeNextChunk: function(stream)
    {
        const separator = ",\n";
        var data = [];
        var length = 0;

        if (this._prologue) {
            data.push(this._prologue);
            length += this._prologue.length;
            delete this._prologue;
        } else {
            if (this._recordIndex === this._payloads.length) {
                stream.close();
                return;
            }
            data.push("");
        }
        while (this._recordIndex < this._payloads.length) {
            var item = JSON.stringify(this._payloads[this._recordIndex]);
            var itemLength = item.length + separator.length;
            if (length + itemLength > WebInspector.TimelineModel.TransferChunkLengthBytes)
                break;
            length += itemLength;
            data.push(item);
            ++this._recordIndex;
        }
        if (this._recordIndex === this._payloads.length)
            data.push(data.pop() + "]");
        stream.write(data.join(separator), this._writeNextChunk.bind(this));
    }
}

/**
 * @constructor
 */
WebInspector.TimelineMergingRecordBuffer = function()
{
    this._backgroundRecordsBuffer = [];
}

/**
 * @constructor
 */
WebInspector.TimelineMergingRecordBuffer.prototype = {
    /**
     * @param {string} thread
     * @param {!Array.<!WebInspector.TimelineModel.Record>} records
     * @return {!Array.<!WebInspector.TimelineModel.Record>}
     */
    process: function(thread, records)
    {
        if (thread) {
            this._backgroundRecordsBuffer = this._backgroundRecordsBuffer.concat(records);
            return [];
        }
        /**
         * @param {!WebInspector.TimelineModel.Record} a
         * @param {!WebInspector.TimelineModel.Record} b
         */
        function recordTimestampComparator(a, b)
        {
            // Never return 0, as the merge function will squash identical entries.
            return a.startTime() < b.startTime() ? -1 : 1;
        }
        var result = this._backgroundRecordsBuffer.mergeOrdered(records, recordTimestampComparator);
        this._backgroundRecordsBuffer = [];
        return result;
    }
}

/**
 * @param {!Object} data
 * @return {?Array.<number>}
 */
WebInspector.TimelineModel._quadFromRectData = function(data)
{
    if (typeof data["x"] === "undefined" || typeof data["y"] === "undefined")
        return null;
    var x0 = data["x"];
    var x1 = data["x"] + data["width"];
    var y0 = data["y"];
    var y1 = data["y"] + data["height"];
    return [x0, y0, x1, y0, x1, y1, x0, y1];
}
