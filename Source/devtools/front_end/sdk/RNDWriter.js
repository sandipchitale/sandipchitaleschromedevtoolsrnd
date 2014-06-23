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
 */
WebInspector.RNDWriter = function()
{
}

WebInspector.RNDWriter.prototype = {
    /**
     * @param {!WebInspector.OutputStream} stream
     * @param {!Array.<!WebInspector.NetworkRequest>} requests
     * @param {!WebInspector.Progress} progress
     */
    write: function(stream, requests, progress)
    {
        this._stream = stream;
        var compositeProgress = new WebInspector.CompositeProgress(progress);
        this._writeProgress = compositeProgress.createSubProgress();
        this._test = JSON.stringify(requests, function(key, value) {
		    if (value instanceof WebInspector.Target) {
		        return;
		    }
		    return value;
		}, 4);
        this._beginWrite();
    },

    _beginWrite: function()
    {
        const jsonIndent = 2;
        this._writeProgress.setTitle(WebInspector.UIString("Writing file…"));
        this._writeProgress.setTotalWork(this._text.length);
        this._bytesWritten = 0;
        this._writeNextChunk(this._stream);
    },

    /**
     * @param {!WebInspector.OutputStream} stream
     * @param {string=} error
     */
    _writeNextChunk: function(stream, error)
    {
        if (this._bytesWritten >= this._text.length || error) {
            stream.close();
            this._writeProgress.done();
            return;
        }
        const chunkSize = 100000;
        var text = this._text.substring(this._bytesWritten, this._bytesWritten + chunkSize);
        this._bytesWritten += text.length;
        stream.write(text, this._writeNextChunk.bind(this));
        this._writeProgress.setWorked(this._bytesWritten);
    }
}
