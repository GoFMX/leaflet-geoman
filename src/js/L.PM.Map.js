import merge from 'lodash/merge';
import translations from '../assets/translations';
import GlobalEditMode from './Mixins/Modes/Mode.Edit';
import GlobalArrowEditMode from './Mixins/Modes/Mode.EditArrows';
import GlobalDragMode from './Mixins/Modes/Mode.Drag';
import GlobalRemovalMode from './Mixins/Modes/Mode.Removal';
import GlobalRotateMode from './Mixins/Modes/Mode.Rotate';
import GlobalColorChangeMode from './Mixins/Modes/Mode.Color';
import EventMixin from './Mixins/Events';
import ArrowDialogMixin from './Mixins/ArrowDialog';
import ColorChangeDialogMixin from './Mixins/ColorChangeDialog';
import createKeyboardMixins from './Mixins/Keyboard';
import { getRenderer } from './helpers';

const Map = L.Class.extend({
  includes: [
    GlobalEditMode,
    GlobalArrowEditMode,
    GlobalDragMode,
    GlobalRemovalMode,
    GlobalRotateMode,
    GlobalColorChangeMode,
    EventMixin,
    ColorChangeDialogMixin,
    ArrowDialogMixin,
  ],
  initialize(map) {
    this.map = map;
    this.Draw = new L.PM.Draw(map);
    this.Toolbar = new L.PM.Toolbar(map);
    this.Keyboard = createKeyboardMixins();
    this.Dialog = { ...ArrowDialogMixin, ...ColorChangeDialogMixin };

    this.globalOptions = {
      snappable: true,
      layerGroup: undefined,
      snappingOrder: [
        'Marker',
        'CircleMarker',
        'Circle',
        'Line',
        'Polygon',
        'Rectangle',
      ],
      panes: {
        vertexPane: 'markerPane',
        layerPane: 'overlayPane',
        markerPane: 'markerPane',
      },
      draggable: true,
    };

    this.Keyboard._initKeyListener(map);

    this.Dialog.colorChangeDialog = this.colorChangeDialogInit({
      close: false,
    }).addTo(this.map);
    this.Dialog.colorChangeInit();

    this._addDialogEvents();
  },
  // eslint-disable-next-line default-param-last
  setLang(lang = 'en', t, fallback = 'en') {
    const oldLang = L.PM.activeLang;
    if (t) {
      translations[lang] = merge(translations[fallback], t);
    }

    L.PM.activeLang = lang;
    this.map.pm.Toolbar.reinit();
    this._fireLangChange(oldLang, lang, fallback, translations[lang]);
  },
  addControls(options) {
    this.Toolbar.addControls(options);
  },
  removeControls() {
    this.Toolbar.removeControls();
  },
  toggleControls() {
    this.Toolbar.toggleControls();
  },
  controlsVisible() {
    return this.Toolbar.isVisible;
  },
  // eslint-disable-next-line default-param-last
  enableDraw(shape = 'Polygon', options) {
    // backwards compatible, remove after 3.0
    if (shape === 'Poly') {
      shape = 'Polygon';
    }

    this.Draw.enable(shape, options);
  },
  disableDraw(shape = 'Polygon') {
    // backwards compatible, remove after 3.0
    if (shape === 'Poly') {
      shape = 'Polygon';
    }

    this.Draw.disable(shape);
  },
  // optionsModifier for special options like ignoreShapes or merge
  setPathOptions(options, optionsModifier = {}) {
    const ignore = optionsModifier.ignoreShapes || [];
    const mergeOptions = optionsModifier.merge || false;

    this.map.pm.Draw.shapes.forEach((shape) => {
      if (ignore.indexOf(shape) === -1) {
        this.map.pm.Draw[shape].setPathOptions(options, mergeOptions);
      }
    });
  },
  getGlobalOptions() {
    return this.globalOptions;
  },
  setGlobalOptions(o) {
    // merge passed and existing options
    const options = merge(this.globalOptions, o);

    // TODO: remove with next major release
    if (options.editable) {
      options.resizeableCircleMarker = options.editable;
      delete options.editable;
    }

    // check if switched the editable mode for CircleMarker while drawing
    let reenableCircleMarker = false;
    if (
      this.map.pm.Draw.CircleMarker.enabled() &&
      !!this.map.pm.Draw.CircleMarker.options.resizeableCircleMarker !==
        !!options.resizeableCircleMarker
    ) {
      this.map.pm.Draw.CircleMarker.disable();
      reenableCircleMarker = true;
    }
    // check if switched the editable mode for Circle while drawing
    let reenableCircle = false;
    if (
      this.map.pm.Draw.Circle.enabled() &&
      !!this.map.pm.Draw.Circle.options.resizableCircle !==
        !!options.resizableCircle
    ) {
      this.map.pm.Draw.Circle.disable();
      reenableCircle = true;
    }

    // enable options for Drawing Shapes
    this.map.pm.Draw.shapes.forEach((shape) => {
      this.map.pm.Draw[shape].setOptions(options);
    });

    if (reenableCircleMarker) {
      this.map.pm.Draw.CircleMarker.enable();
    }

    if (reenableCircle) {
      this.map.pm.Draw.Circle.enable();
    }

    // enable options for Editing
    const layers = L.PM.Utils.findLayers(this.map);
    layers.forEach((layer) => {
      layer.pm.setOptions(options);
    });

    this.map.fire('pm:globaloptionschanged');

    // store options
    this.globalOptions = options;

    // apply the options (actually trigger the functionality)
    this.applyGlobalOptions();
  },
  applyGlobalOptions() {
    const layers = L.PM.Utils.findLayers(this.map);
    layers.forEach((layer) => {
      if (layer.pm.enabled()) {
        layer.pm.applyOptions();
      }
    });
  },
  globalDrawModeEnabled() {
    return !!this.Draw.getActiveShape();
  },
  globalCutModeEnabled() {
    return !!this.Draw.Cut.enabled();
  },
  enableGlobalCutMode(options) {
    return this.Draw.Cut.enable(options);
  },
  toggleGlobalCutMode(options) {
    return this.Draw.Cut.toggle(options);
  },
  disableGlobalCutMode() {
    return this.Draw.Cut.disable();
  },
  getGeomanLayers(asGroup = false) {
    const layers = L.PM.Utils.findLayers(this.map);
    if (!asGroup) {
      return layers;
    }
    const group = L.featureGroup();
    group._pmTempLayer = true;
    layers.forEach((layer) => {
      group.addLayer(layer);
    });
    return group;
  },
  getGeomanDrawLayers(asGroup = false) {
    const layers = L.PM.Utils.findLayers(this.map).filter(
      (l) => l._drawnByGeoman === true
    );
    if (!asGroup) {
      return layers;
    }
    const group = L.featureGroup();
    group._pmTempLayer = true;
    layers.forEach((layer) => {
      group.addLayer(layer);
    });
    return group;
  },
  _addDialogEvents() {
    this.map.on('pm:drawend', () => {
      this.Dialog.closeColorChangeDialog();
      this.Dialog.closeArrowDialog();
    });

    this.map.on('dialog:moveend', this.updateColorisPosition);
  },
  // returns the map instance by default or a layergroup is set through global options
  _getContainingLayer() {
    return this.globalOptions.layerGroup &&
      this.globalOptions.layerGroup instanceof L.LayerGroup
      ? this.globalOptions.layerGroup
      : this.map;
  },
  _isCRSSimple() {
    return this.map.options.crs === L.CRS.Simple;
  },
  // in Canvas mode we need to convert touch- and pointerevents (IE) to mouseevents, because Leaflet don't support them.
  _touchEventCounter: 0,
  _addTouchEvents(elm) {
    if (this._touchEventCounter === 0) {
      L.DomEvent.on(elm, 'touchmove', this._canvasTouchMove, this);
      L.DomEvent.on(
        elm,
        'touchstart touchend touchcancel',
        this._canvasTouchClick,
        this
      );
    }
    this._touchEventCounter += 1;
  },
  _removeTouchEvents(elm) {
    if (this._touchEventCounter === 1) {
      L.DomEvent.off(elm, 'touchmove', this._canvasTouchMove, this);
      L.DomEvent.off(
        elm,
        'touchstart touchend touchcancel',
        this._canvasTouchClick,
        this
      );
    }
    this._touchEventCounter =
      this._touchEventCounter <= 1 ? 0 : this._touchEventCounter - 1;
  },
  _canvasTouchMove(e) {
    getRenderer(this.map)._onMouseMove(this._createMouseEvent('mousemove', e));
  },
  _canvasTouchClick(e) {
    let type = '';
    if (e.type === 'touchstart' || e.type === 'pointerdown') {
      type = 'mousedown';
    } else if (e.type === 'touchend' || e.type === 'pointerup') {
      type = 'mouseup';
    } else if (e.type === 'touchcancel' || e.type === 'pointercancel') {
      type = 'mouseup';
    }
    if (!type) {
      return;
    }
    getRenderer(this.map)._onClick(this._createMouseEvent(type, e));
  },
  _createMouseEvent(type, e) {
    let mouseEvent;
    const touchEvt = e.touches[0] || e.changedTouches[0];
    try {
      mouseEvent = new MouseEvent(type, {
        bubbles: e.bubbles,
        cancelable: e.cancelable,
        view: e.view,
        detail: touchEvt.detail,
        screenX: touchEvt.screenX,
        screenY: touchEvt.screenY,
        clientX: touchEvt.clientX,
        clientY: touchEvt.clientY,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        button: e.button,
        relatedTarget: e.relatedTarget,
      });
    } catch (ex) {
      mouseEvent = document.createEvent('MouseEvents');
      mouseEvent.initMouseEvent(
        type,
        e.bubbles,
        e.cancelable,
        e.view,
        touchEvt.detail,
        touchEvt.screenX,
        touchEvt.screenY,
        touchEvt.clientX,
        touchEvt.clientY,
        e.ctrlKey,
        e.altKey,
        e.shiftKey,
        e.metaKey,
        e.button,
        e.relatedTarget
      );
    }
    return mouseEvent;
  },
});

export default Map;
