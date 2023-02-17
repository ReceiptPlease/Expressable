
import type { IPositionable } from './interfaces/i_positionable.js'
import type { WorkspaceSvg } from './workspace_svg.js'
import type { UiMetrics } from './metrics_manager.js'

import { ComponentManager } from './component_manager.js'
import { SPRITE } from './sprites.js'
import { Size } from './utils/size.js'
import { Rect } from './utils/rect.js'
import { Svg } from './utils/svg.js'

import * as browserEvents from './browser_events.js'
import * as uiPosition from './positionable_helpers.js'
import * as eventUtils from './events/utils.js'
import * as Touch from './touch.js'
import * as dom from './utils/dom.js'
import * as Css from './css.js'


export class ZoomControls implements IPositionable {

    /**
     *  Unique ID to register with the ComponentManager.
     */

    id = 'zoomControls'


    /**
     * A handle to use to unbind the mouse down event handler for zoom reset
     *    button. Opaque data returned from browserEvents.conditionalBind.
     */

    private onZoomResetWrapper : browserEvents.Data | null = null


    /**
     * A handle to use to unbind the mouse down event handler for zoom in
     * button. Opaque data returned from browserEvents.conditionalBind.
     */

    private onZoomInWrapper: browserEvents.Data | null = null


    /**
     * A handle to use to unbind the mouse down event handler for zoom out
     * button. Opaque data returned from browserEvents.conditionalBind.
     */

    private onZoomOutWrapper: browserEvents.Data | null = null


    private zoomResetGroup : SVGGElement | null = null
    private zoomOutGroup : SVGGElement | null = null
    private zoomInGroup : SVGGElement | null = null
    private svgGroup : SVGElement | null = null


    /**
     *  Sizes / Spacings measured in pixels.
     */

    private readonly MARGIN_HORIZONTAL = 20 // Zoom Controls ⟷ Left / Right Edge
    private readonly MARGIN_VERTICAL = 20 // Zoom Controls ⟷ Top / Bottom Edge
    private readonly LARGE_SPACING = 11 // Zoom In ⟷ Reset
    private readonly SMALL_SPACING = 2 // Zoom In ⟷ Zoom Out
    private readonly HEIGHT = 32
    private readonly WIDTH = 32


    /**
     *  Position
     */

    private left = 0;
    private top = 0;

    private initialized = false;


    constructor ( private readonly workspace : WorkspaceSvg ) {}


    /**
     * Create the zoom controls.
     *
     * @returns The zoom controls SVG group.
     */

    createDom (){

        this.svgGroup = dom
            .createSvgElement(Svg.G,{});

        // Each filter/pattern needs a unique ID for the case of multiple Blockly
        // instances on a page.  Browser behaviour becomes undefined otherwise.
        // https://neil.fraser.name/news/2015/11/01/

        const rnd = String(Math.random()).substring(2);
        this.createZoomOutSvg(rnd);
        this.createZoomInSvg(rnd);

        // If we zoom to the center and the workspace isn't movable we could
        // loose blocks at the edges of the workspace.

        if( this.workspace.isMovable() )
            this.createZoomResetSvg(rnd);

        return this.svgGroup;
    }


    init (){

        this.workspace
        .getComponentManager()
        .addComponent({
            component: this,
            weight: 2,
            capabilities: [ComponentManager.Capability.POSITIONABLE],
        });

        this.initialized = true;
    }

    /**
     * Disposes of this zoom controls.
     * Unlink from all DOM elements to prevent memory leaks.
     */

    dispose (){

        this.workspace
        .getComponentManager()
        .removeComponent('zoomControls');

        if( this.svgGroup )
            dom.removeNode(this.svgGroup);

        if( this.onZoomResetWrapper )
            browserEvents.unbind(this.onZoomResetWrapper);

        if( this.onZoomInWrapper )
            browserEvents.unbind(this.onZoomInWrapper);

        if( this.onZoomOutWrapper )
            browserEvents.unbind(this.onZoomOutWrapper);
    }


    /**
     *  Bounding box measured in pixels, relative to the injected div.
     *
     *  @returns Null if other UI elements should ignore it.
     */

    getBoundingRectangle () : Rect | null {

        let height = this.SMALL_SPACING + 2 * this.HEIGHT;

        if( this.zoomResetGroup )
            height += this.LARGE_SPACING + this.HEIGHT;

        const
            bottom = this.top + height ,
            right = this.left + this.WIDTH ;

        return new Rect(
            this.top , bottom ,
            this.left , right
        )
    }


    /**
     * Positions the zoom controls.
     * It is positioned in the opposite corner to the corner the
     * categories/toolbox starts at.
     *
     * @param metrics The workspace metrics.
     * @param savedPositions List of rectangles that are already on the workspace.
     */

    position ( metrics : UiMetrics , savedPositions : Rect [] ){

        if( ! this.initialized )
            return

        const cornerPosition = uiPosition
            .getCornerOppositeToolbox(this.workspace,metrics);

        let height =
            + this.SMALL_SPACING
            + 2 * this.HEIGHT;

        if( this.zoomResetGroup )
            height +=
                + this.LARGE_SPACING
                + this.HEIGHT;

        const startRect = uiPosition
            .getStartPositionRect(
                cornerPosition ,
                new Size(this.WIDTH,height) ,
                this.MARGIN_HORIZONTAL ,
                this.MARGIN_VERTICAL ,
                metrics ,
                this.workspace
            );

        const { vertical : verticalPosition } = cornerPosition;

        const bumpDirection = ( verticalPosition === uiPosition.verticalPosition.TOP )
            ? uiPosition.bumpDirection.DOWN
            : uiPosition.bumpDirection.UP ;

        const positionRect = uiPosition.bumpPositionRect(
            startRect, this.MARGIN_VERTICAL, bumpDirection, savedPositions);

        if( verticalPosition === uiPosition.verticalPosition.TOP ){

            const zoomInTranslateY =
                + this.SMALL_SPACING
                + this.HEIGHT ;

            this.zoomInGroup
                ?.setAttribute('transform',`translate(0,${ zoomInTranslateY })`);

            if( this.zoomResetGroup ){

                const zoomResetTranslateY =
                    + zoomInTranslateY
                    + this.LARGE_SPACING
                    + this.HEIGHT ;

                this.zoomResetGroup
                    .setAttribute('transform',`translate(0,${ zoomResetTranslateY })`);
            }

        } else {

            const zoomInTranslateY = ( this.zoomResetGroup )
                ? this.LARGE_SPACING + this.HEIGHT
                : 0 ;

            this.zoomInGroup
                ?.setAttribute('transform',`translate(0,${ zoomInTranslateY })`);

            const zoomOutTranslateY =
                + zoomInTranslateY
                + this.SMALL_SPACING
                + this.HEIGHT;

            this.zoomOutGroup
                ?.setAttribute('transform',`translate(0,${ zoomOutTranslateY })`);
        }

        this.left = positionRect.left;
        this.top = positionRect.top;

        this.svgGroup
            ?.setAttribute('transform',`translate(${ this.left },${ this.top })`);
    }


    /**
     * Create the zoom in icon and its event handler.
     *
     * @param suffix The random string to use as a suffix in the clip path's ID.
     *     These IDs must be unique in case there are multiple Blockly instances
     *     on the same page.
     */
 /* This markup will be generated and added to the .svgGroup:
        <g class="blocklyZoom">
            <clipPath id="blocklyZoomoutClipPath837493">
            <rect width="32" height="32></rect>
            </clipPath>
            <image width="96" height="124" x="-64" y="-92"
        xlink:href="media/sprites.png"
                clip-path="url(#blocklyZoomoutClipPath837493)"></image>
        </g>
        */
    private createZoomOutSvg ( suffix : string ){

        this.zoomOutGroup = dom
            .createSvgElement(Svg.G,{ 'class' : 'blocklyZoom' },this.svgGroup);

        const clip = dom
            .createSvgElement(Svg.CLIPPATH,{ id : `blocklyZoomoutClipPath${ suffix }` },this.zoomOutGroup);

        dom.createSvgElement(
            Svg.RECT , {
                height : 32 ,
                width : 32
            },clip);

        const zoomoutSvg = dom
            .createSvgElement(
                Svg.IMAGE, {
                    'clip-path' : `url(#blocklyZoomoutClipPath${ suffix })` ,
                    height : SPRITE.height ,
                    width : SPRITE.width ,
                    x : -64 ,
                    y : -92 ,
                },this.zoomOutGroup);

        zoomoutSvg.setAttributeNS(
            dom.XLINK_NS,'xlink:href',this.workspace.options.pathToMedia + SPRITE.url);

        this.onZoomOutWrapper = browserEvents
            .conditionalBind(
                this.zoomOutGroup , 'pointerdown' ,
                null , this.zoom.bind(this,-1)
            );
    }


    /**
     * Create the zoom out icon and its event handler.
     *
     * @param suffix The random string to use as a suffix in the clip path's ID.
     *     These IDs must be unique in case there are multiple Blockly instances
     *     on the same page.
     */

     /* This markup will be generated and added to the .svgGroup:
        <g class="blocklyZoom">
            <clipPath id="blocklyZoominClipPath837493">
            <rect width="32" height="32"></rect>
            </clipPath>
            <image width="96" height="124" x="-32" y="-92"
        xlink:href="media/sprites.png"
                clip-path="url(#blocklyZoominClipPath837493)"></image>
        </g>
        */

    private createZoomInSvg ( suffix : string ){


        this.zoomInGroup =
            dom.createSvgElement(Svg.G, {'class': 'blocklyZoom'}, this.svgGroup);
        const clip = dom.createSvgElement(
            Svg.CLIPPATH, {'id': 'blocklyZoominClipPath' + suffix}, this.zoomInGroup);
        dom.createSvgElement(
            Svg.RECT, {
                'width': 32,
                'height': 32,
            },
            clip);
        const zoominSvg = dom.createSvgElement(
            Svg.IMAGE, {
                'width': SPRITE.width,
                'height': SPRITE.height,
                'x': -32,
                'y': -92,
                'clip-path': 'url(#blocklyZoominClipPath' + suffix + ')',
            },
            this.zoomInGroup);
        zoominSvg.setAttributeNS(
            dom.XLINK_NS, 'xlink:href',
            this.workspace.options.pathToMedia + SPRITE.url);

        // Attach listener.
        this.onZoomInWrapper = browserEvents.conditionalBind(
            this.zoomInGroup, 'pointerdown', null, this.zoom.bind(this, 1));
    }


    /**
     * Handles a mouse down event on the zoom in or zoom out buttons on the
     *    workspace.
     *
     * @param amount Amount of zooming. Negative amount values zoom out, and
     *     positive amount values zoom in.
     * @param event A mouse down event.
     */

    private zoom ( amount : number , event : PointerEvent ){

        this.workspace.markFocused();
        this.workspace.zoomCenter(amount);

        this.fireZoomEvent();

        // Don't block future drags.
        Touch.clearTouchIdentifier();

        // Don't start a workspace scroll.
        event.stopPropagation();

        // Stop double-clicking from selecting text.
        event.preventDefault();
    }


    /**
     * Create the zoom reset icon and its event handler.
     *
     * @param rnd The random string to use as a suffix in the clip path's ID.
     *     These IDs must be unique in case there are multiple Blockly instances
     *     on the same page.
     */

    private createZoomResetSvg(rnd: string) {
    /* This markup will be generated and added to the .svgGroup:
        <g class="blocklyZoom">
            <clipPath id="blocklyZoomresetClipPath837493">
            <rect width="32" height="32"></rect>
            </clipPath>
            <image width="96" height="124" x="-32" y="-92"
        xlink:href="media/sprites.png"
                clip-path="url(#blocklyZoomresetClipPath837493)"></image>
        </g>
        */
    this.zoomResetGroup =
        dom.createSvgElement(Svg.G, {'class': 'blocklyZoom'}, this.svgGroup);
    const clip = dom.createSvgElement(
        Svg.CLIPPATH, {'id': 'blocklyZoomresetClipPath' + rnd},
        this.zoomResetGroup);
    dom.createSvgElement(Svg.RECT, {'width': 32, 'height': 32}, clip);
    const zoomresetSvg = dom.createSvgElement(
        Svg.IMAGE, {
            'width': SPRITE.width,
            'height': SPRITE.height,
            'y': -92,
            'clip-path': 'url(#blocklyZoomresetClipPath' + rnd + ')',
        },
        this.zoomResetGroup);
    zoomresetSvg.setAttributeNS(
        dom.XLINK_NS, 'xlink:href',
        this.workspace.options.pathToMedia + SPRITE.url);

    // Attach event listeners.
    this.onZoomResetWrapper = browserEvents.conditionalBind(
        this.zoomResetGroup, 'pointerdown', null, this.resetZoom.bind(this));
    }


    /**
     * Handles a mouse down event on the reset zoom button on the workspace.
     *
     * @param event A mouse down event.
     */

    private resetZoom ( event : PointerEvent ){

        const { workspace } = this;

        workspace.markFocused();


        /**
         *  zoom is passed amount and computes the new scale using the formula:
         *  targetScale = currentScale * Math.pow(speed, amount)
         */

        const { scale , options } = workspace;

        const { scaleSpeed , startScale } = options.zoomOptions;

        /**
         *  amount = log(speed, (targetScale / currentScale))
         *  Math.log computes natural logarithm (ln), to change the base, use
         *  formula: log(base, value) = ln(value) / ln(base)
         */

        const amount =
            + Math.log(startScale / scale)
            / Math.log(scaleSpeed);

        workspace.beginCanvasTransition();
        workspace.zoomCenter(amount);
        workspace.scrollCenter();

        setTimeout(workspace.endCanvasTransition.bind(workspace),500);

        this.fireZoomEvent();

        // Don't block future drags.
        Touch.clearTouchIdentifier();

        // Don't start a workspace scroll.
        event.stopPropagation();

        // Stop double-clicking from selecting text.
        event.preventDefault();
    }


    private fireZoomEvent (){

        const Event = eventUtils
            .get(eventUtils.CLICK);

        const event = new Event(null,this.workspace.id,'zoom_controls');
        eventUtils.fire(event);
    }
}


Css.register(`

    .blocklyZoom > :is( image , svg > image ) {
        opacity : .4 ;
    }

    .blocklyZoom > :is( image , svg > image ):hover {
        opacity : .6 ;
    }

    .blocklyZoom > :is( image , svg > image ):active {
        opacity : .8 ;
    }
`);
