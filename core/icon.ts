
import { Coordinate } from './utils/coordinate.js'
import { Size } from './utils/size.js'
import { Svg } from './utils/svg.js'

import type { BlockSvg } from './block_svg.js'
import type { Bubble } from './bubble.js'

import * as browserEvents from './browser_events.js'
import * as svgMath from './utils/svg_math.js'
import * as dom from './utils/dom.js'


export abstract class Icon {

    protected iconXY_ : Coordinate | null = null
    protected bubble_ : Bubble | null = null
    protected block_ : BlockSvg | null

    collapseHidden = true
    iconGroup_ : SVGGElement | null = null

    readonly SIZE = 17


    constructor ( block : BlockSvg ){
        this.block_ = block
    }


    /* Here's the markup that will be generated:
        <g class="blocklyIconGroup">
            ...
        </g>
    */

    createIcon (){

        if( this.iconGroup_ )
            return

        const group = dom
            .createSvgElement(Svg.G,{ class : 'blocklyIconGroup' });

        this.iconGroup_ = group;


        const { block } = this;

        if( block.isInFlyout )
            dom.addClass(group,'blocklyIconGroupReadonly');

        this.drawIcon_(group);

        block
        .getSvgRoot()
        .appendChild(group);

        browserEvents.conditionalBind(
            group,'pointerup',this,this.iconClick_);

        this.updateEditable();
    }


    dispose (){
        dom.removeNode(this.iconGroup_);
        this.setVisible(false);
    }


    updateEditable () {}


    isVisible (){
        return !! this.bubble_
    }



    protected iconClick_ ( event : PointerEvent ){

        const { block } = this;

        // Drag operation is concluding.  Don't open the editor.

        if( block.workspace.isDragging() )
            return

        if( block.isInFlyout )
            return

        if( browserEvents.isRightButton(event) )
            return

        this.setVisible( ! this.isVisible() );
    }


    applyColour (){

        if( ! this.isVisible() )
            return

        const { colourPrimary } = this
            .getBlock().style;

        this.bubble_
            ?.setColour(colourPrimary);
    }


    /**
     * Notification that the icon has moved.  Update the arrow accordingly.
     *
     * @param position Absolute location in workspace coordinates.
     */

    setIconLocation ( position : Coordinate ){

        this.iconXY_ = position;

        if( this.isVisible() )
            this.bubble_?.setAnchorLocation(position);
    }

    /**
     * Notification that the icon has moved, but we don't really know where.
     * Recompute the icon's location from scratch.
     */

    computeIconLocation (){

        // Find coordinates for the centre of the icon and update the arrow.

        const blockXY = this
            .getBlock()
            .getRelativeToSurfaceXY();

        const iconXY = svgMath
            .getRelativeXY(this.iconGroup_ as SVGElement);

        const newXY = new Coordinate(
            blockXY.x + iconXY.x + this.SIZE / 2 ,
            blockXY.y + iconXY.y + this.SIZE / 2
        );

        if( Coordinate.equals(this.getIconLocation(),newXY) )
            return

        this.setIconLocation(newXY);
    }


    /**
     * Returns the center of the block's icon relative to the surface.
     *
     * @returns Object with x and y properties in workspace coordinates.
     */

    getIconLocation (){
        return this.iconXY_
    }


    /**
     * Get the size of the icon as used for rendering.
     * This differs from the actual size of the icon, because it bulges slightly
     * out of its row rather than increasing the height of its row.
     *
     * @returns Height and width.
     */

    // TODO (#2562): Remove getCorrectedSize.

    getCorrectedSize (){
        return new Size(this.SIZE,this.SIZE - 2)
    }


    protected drawIcon_ ( _group : Element ) {}


    setVisible ( _visible : boolean ) {}


    protected getBlock (){

        const { block_ } = this;

        if( block_ )
            return block_

        throw new Error('Block is not set for this icon.');
    }

    protected get block (){
        return this.getBlock();
    }
}
