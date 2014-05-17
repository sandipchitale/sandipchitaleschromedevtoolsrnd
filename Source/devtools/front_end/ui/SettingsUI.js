/*
 * Copyright (C) 2014 Google Inc. All rights reserved.
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

WebInspector.SettingsUI = {}

/**
 * @param {string} name
 * @param {!WebInspector.Setting} setting
 * @param {boolean=} omitParagraphElement
 * @param {!Element=} inputElement
 * @param {string=} tooltip
 * @return {!Element}
 */
WebInspector.SettingsUI.createSettingCheckbox = function(name, setting, omitParagraphElement, inputElement, tooltip)
{
    var input = inputElement || document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    WebInspector.SettingsUI.bindCheckbox(input, setting);

    var label = document.createElement("label");
    label.appendChild(input);
    label.createTextChild(name);
    if (tooltip)
        label.title = tooltip;

    if (omitParagraphElement)
        return label;

    var p = document.createElement("p");
    p.appendChild(label);
    return p;
}

/**
 * @param {!Element} input
 * @param {!WebInspector.Setting} setting
 */
WebInspector.SettingsUI.bindCheckbox = function(input, setting)
{
    function settingChanged()
    {
        if (input.checked !== setting.get())
            input.checked = setting.get();
    }
    setting.addChangeListener(settingChanged);
    settingChanged();

    function inputChanged()
    {
        if (setting.get() !== input.checked)
            setting.set(input.checked);
    }
    input.addEventListener("change", inputChanged, false);
}

/**
 * @param {string} label
 * @param {!WebInspector.Setting} setting
 * @param {boolean} numeric
 * @param {number=} maxLength
 * @param {string=} width
 * @param {function(string):?string=} validatorCallback
 */
WebInspector.SettingsUI.createSettingInputField = function(label, setting, numeric, maxLength, width, validatorCallback)
{
    var p = document.createElement("p");
    var labelElement = p.createChild("label");
    labelElement.textContent = label;
    var inputElement = p.createChild("input");
    inputElement.value = setting.get();
    inputElement.type = "text";
    if (numeric)
        inputElement.className = "numeric";
    if (maxLength)
        inputElement.maxLength = maxLength;
    if (width)
        inputElement.style.width = width;

    var errorMessageLabel;
    if (validatorCallback) {
        errorMessageLabel = p.createChild("div");
        errorMessageLabel.classList.add("field-error-message");
        inputElement.oninput = onInput;
        onInput();
    }

    function onInput()
    {
        var error = validatorCallback(inputElement.value);
        if (!error)
            error = "";
        errorMessageLabel.textContent = error;
    }

    function onBlur()
    {
        setting.set(numeric ? Number(inputElement.value) : inputElement.value);
    }
    inputElement.addEventListener("blur", onBlur, false);

    return p;
}

WebInspector.SettingsUI.createCustomSetting = function(name, element)
{
    var p = document.createElement("p");
    var fieldsetElement = document.createElement("fieldset");
    fieldsetElement.createChild("label").textContent = name;
    fieldsetElement.appendChild(element);
    p.appendChild(fieldsetElement);
    return p;
}

/**
 * @param {!WebInspector.Setting} setting
 * @return {!Element}
 */
WebInspector.SettingsUI.createSettingFieldset = function(setting)
{
    var fieldset = document.createElement("fieldset");
    fieldset.disabled = !setting.get();
    setting.addChangeListener(settingChanged);
    return fieldset;

    function settingChanged()
    {
        fieldset.disabled = !setting.get();
    }
}

/**
 * @param {string} text
 * @return {?string}
 */
WebInspector.SettingsUI.regexValidator = function(text)
{
    var regex;
    try {
        regex = new RegExp(text);
    } catch (e) {
    }
    return regex ? null : WebInspector.UIString("Invalid pattern");
}

/**
 * @constructor
 */
WebInspector.UISettingDelegate = function()
{
}

WebInspector.UISettingDelegate.prototype = {
    /**
     * @return {?Element}
     */
    settingElement: function()
    {
        return null;
    }
}
