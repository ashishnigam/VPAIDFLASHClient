//if this code already run once don't do anything
(function () {
if (window.FlashVPAID) return;

let IVPAID = require('./IVPAID').IVPAID;
let noop = require('./utils').noop;
let unique = require('./utils').unique;
let uniqueVPAID = unique('vpaid');
let instances = {};
const VPAID_FLASH_HANDLER = 'vpaid_video_flash_handler';

function createElementWithID(parent, id) {
    var nEl = document.createElement('div');
    nEl.id = id;
    parent.innerHTML = '';
    parent.appendChild(nEl);
    return nEl;
}

function isPositiveInt(newVal, oldVal) {
    return Number.isSafeInteger(newVal) && newVal > 0 ? newVal : oldVal;
}

class FlashVPAID extends IVPAID {
    constructor (vpaidWrapper, callback, swfConfig = {data: 'VPAIDFlash.swf', width: 800, height: 400}, version = '9', params = { wmode: 'transparent', salign: 'tl', allowScriptAccess: 'always'}, debug = false) {
        super();

        this._handlers = {};
        this._callbacks = {};
        this._vpaidWrapper = vpaidWrapper;
        this._flashID = uniqueVPAID();
        this._load =  callback || noop;


        //validate the height
        swfConfig.width = isPositiveInt(swfConfig.width, 800);
        swfConfig.height = isPositiveInt(swfConfig.height, 400);

        //cache sizes
        this._width = swfConfig.width;
        this._height = swfConfig.height;


        this._uniqueMethodIdentifier = unique(this._flashID);
        createElementWithID(vpaidWrapper, this._flashID);

        //because flash externalInterface will call
        instances[this._flashID] = this;

        params.movie = swfConfig.data;
        params.FlashVars = `flashid=${this._flashID}&handler=${VPAID_FLASH_HANDLER}&debug=${debug}`;

        if (swfobject.hasFlashPlayerVersion(version)) {
            this.el = swfobject.createSWF(swfConfig, params, this._flashID);
        }

        //if this.el is undefined means swfobject failed to create the swfobject
        if (!this.el) return this;
    }

    //internal methods don't call outside of FlashVPAID
    _safeFlashMethod(methodName, args = [], callback = undefined) {
        var callbackID = '';
        // if no callback, some methods the return is void so they don't need callback
        if (callback) {
            var callbackID = this._uniqueMethodIdentifier();
            this._callbacks[callbackID] = callback;
        }


        try {
            //methods are created by ExternalInterface.addCallback in as3 code, if for some reason it failed
            //this code will throw an error
            this.el[methodName]([callbackID].concat(args));

        } catch (e) {
            if (callback) {
                delete this.callback[callbackID];
                callback(e);
            } else {

                //if there isn't any callback to return error use error event handler
                this._fireEvent('error', [e]);
            }
            console.log(e);
        }
    }

    _fireEvent(eventName, args) {
        //TODO: check if forEach and isArray is added to the browser with babeljs
        if (Array.isArray(this._handlers[eventName])) {
            this._handlers[eventName].forEach(function (callback) {
                setTimeout(function () {
                    callback(args);
                }, 0);
            });
        }
    }

    _flash_handShake (message) {
        //this code will be executed if flash is prepared to be
        //executed
        if (message == 'prepared') {
            this._load();
        }
    }

    _flash_methodAnswer(methodName, callbackID, args) {

        //method's that return void will not have callbacks
        if (callbackID === '') return;

        if (!this._callbacks[callbackID]) {
            //TODO: something is wrong, this should never happens if it happens fire an error
            return;
        }

        //TODO: check with carlos if we need to use apply instead
        this._callbacks[callbackID](args);
        delete this._callbacks[callbackID];
    }

    //methods like properties specific to this implementation of VPAID
    getSize() {
        return {width: this._width, height: this._height};
    }
    setSize(newWidth, newHeight) {
        this._width = isPositiveInt(newWidth, this._width);
        this._height = isPositiveInt(newHeight, this._height);
        this._el.setAttribute('width', this._width);
        this._el.setAttribute('height', this._height);
    }
    getWidth() {
        return this._width;
    }
    setWidth(newWidth) {
        this.setSize(newWidth, this._height);
    }
    getHeight() {
        return this._height;
    }
    setHeight(newHeight) {
        this.setSize(this._width, newHeight);
    }
    getFlashID() {
        return this._flashID;
    }

    //methods specific to this implementation of VPAID
    on(eventName, callback) {
        if (!this._handlers[eventName]) {
            this._handlers[eventName] = [];
        }
        this._handlers[eventName].push(callback);
    }

    loadAdUnit(adURL, callback) {
        this._safeFlashMethod('loadAdUnit', [adURL], callback);
    }
    unloadAdUnit(callback) {
        this._safeFlashMethod('unloadAdUnit', [], callback);
    }

    //VPAID methods and properties of VPAID spec
    //async methods
    handshakeVersion(playerVPAIDVersion = '2.0', callback = undefined) {
        this._safeFlashMethod('handshakeVersion', [playerVPAIDVersion], callback);
    }
    initAd (viewMode, desiredBitrate, width = 0, height = 0, creativeData = '', environmentVars = '') {
        //resize element that has the flash object
        this.size(width, height);

        this._safeFlashMethod('initAd', [this.getWidth(), this.getHeight(), viewMode, desiredBitrate, creativeData, environmentVars]);
    }
    resizeAd(width, height, viewMode) {
        //resize element that has the flash object
        this.size(width, height);

        //resize ad inside the flash
        this._safeFlashMethod('resizeAd', [this.getWidth(), this.getHeight(), viewMode]);
    }
    startAd() {
        this._safeFlashMethod('startAd');
    }
    stopAd() {
        this._safeFlashMethod('stopAd');
    }
    pauseAd() {
        this._safeFlashMethod('pauseAd');
    }
    resumeAd() {
        this._safeFlashMethod('resumeAd');
    }
    expandAd() {
        this._safeFlashMethod('expandAd');
    }
    collapseAd() {
        this._safeFlashMethod('collapseAd');
    }
    skipAd() {
        this._safeFlashMethod('skipAd');
    }

    //properties that will be treat as async methods
    adLinear(callback) {
        this._safeFlashMethod('adLinear', [], callback);
    }
    adWidth(callback) {
        this._safeFlashMethod('adWidth', [], callback);
    }
    adHeight(callback) {
        this._safeFlashMethod('adHeight', [], callback);
    }
    adExpanded(callback) {
        this._safeFlashMethod('adExpanded', [], callback);
    }
    adSkippableState(callback) {
        this._safeFlashMethod('adSkippableState', [], callback);
    }
    adRemainingTime(callback) {
        this._safeFlashMethod('adRemainingTime', [], callback);
    }
    adDuration(callback) {
        this._safeFlashMethod('adDuration', [], callback);
    }

    setAdVolume(volume) {
        this._safeFlashMethod('setAdVolume', [volume]);
    }
    getAdVolume(callback) {
        this._safeFlashMethod('getAdVolume', [], callback);
    }

    adCompanions(callback) {
        this._safeFlashMethod('adCompanions', [], callback);
    }
    adIcons(callback) {
        this._safeFlashMethod('adIcons', [], callback);
    }
}

window[VPAID_FLASH_HANDLER] = function (flashID, type, event, ...message) {
    console.log('flashID:', flashID, 'type:', type, 'eventOrMethod:', event, 'message:', message);
    if (event === 'handShake') {
        instances[flashID]._flash_handShake(message[0]);
    } else {
        let callID = message.shift();
        if (type !== 'event') {
            instances[flashID]._flash_methodAnswer(event, callID, message);
        } else {
            instances[flashID]._fireEvent(event, callID, message);
        }
    }
}
window.FlashVPAID = FlashVPAID;

})();

