
/**
 *  Manages markers and the cursor.
 */

import type { WorkspaceSvg } from './workspace_svg.js'
import type { Cursor } from './keyboard_nav/cursor.js'
import type { Marker } from './keyboard_nav/marker.js'


export class MarkerManager {

    /** The name of the local marker. */

    static readonly LOCAL_MARKER = 'local_marker_1'

    private cursor_: Cursor|null = null

    private markerSvg_ : SVGElement | null = null
    private cursorSvg_ : SVGElement | null = null

    private markers = new Map<string, Marker>


    constructor ( private readonly workspace : WorkspaceSvg ) {}


    /**
     * Register the marker by adding it to the map of markers.
     *
     * @param id A unique identifier for the marker.
     * @param marker The marker to register.
     */

    registerMarker ( id : string , marker : Marker ){

        const { markers } = this;

        if( markers.has(id) )
            this.unregisterMarker(id);


        const { workspace } = this;

        const drawer = workspace
            .getRenderer()
            .makeMarkerDrawer(workspace,marker);

        marker.setDrawer(drawer);


        const dom = marker
            .getDrawer()
            .createDom();

        this.setMarkerSvg(dom);


        markers.set(id,marker);
    }


    /**
     * Unregister the marker by removing it from the map of markers.
     *
     * @param id The ID of the marker to unregister.
     */

    unregisterMarker(id: string) {

        const { markers } = this;

        const marker =
            markers.get(id);

        if( ! marker )
            throw Error(
                `Marker with ID ${ id } does not exist.
                 Can only unregister markers that exist.`);

        marker.dispose();
        this.markers.delete(id);
    }


    /**
     * Get the cursor for the workspace.
     *
     * @returns The cursor for this workspace.
     */

    getCursor (){
        return this.cursor_
    }


    /**
     * Get a single marker that corresponds to the given ID.
     *
     * @param id A unique identifier for the marker.
     * @returns The marker that corresponds to the given ID, or null if none
     *     exists.
     */

    getMarker ( id : string ){
        return this.markers
            .get(id) ?? null
    }


    /**
     * Sets the cursor and initializes the drawer for use with keyboard
     * navigation.
     *
     * @param cursor The cursor used to move around this workspace.
     */

    setCursor ( cursor : Cursor ){

        if( this.cursor_ && this.cursor_.getDrawer() )
            this.cursor_.getDrawer().dispose();

        this.cursor_ = cursor;

        if( ! this.cursor_ )
            return

        const { workspace } = this;

        const drawer = workspace
            .getRenderer()
            .makeMarkerDrawer(workspace,this.cursor_);

        this.cursor_.setDrawer(drawer);

        this.setCursorSvg(this.cursor_.getDrawer().createDom());
    }


    /**
     * Add the cursor SVG to this workspace SVG group.
     *
     * @param cursor The SVG root of the cursor to be added to the workspace
     *     SVG group.
     * @internal
     */

    setCursorSvg ( cursor : SVGElement | null ){

        if( cursor )
            this.workspace
            .getBlockCanvas()
            ?.appendChild(cursor);

        this.cursorSvg_ = cursor;
    }


    /**
     * Add the marker SVG to this workspaces SVG group.
     *
     * @param marker The SVG root of the marker to be added to the workspace
     *     SVG group.
     * @internal
     */

    setMarkerSvg ( marker : SVGElement | null ){

        if( ! marker ){
            this.markerSvg_ = null;
            return
        }

        const canvas = this.workspace
            .getBlockCanvas();

        if( ! canvas )
            return

        if( this.cursorSvg_ )
            canvas.insertBefore(marker,this.cursorSvg_);
        else
            canvas.appendChild(marker);
    }

    /**
     * Redraw the attached cursor SVG if needed.
     *
     * @internal
     */

    updateMarkers (){

        const { workspace } = this;

        if( ! workspace.keyboardAccessibilityMode )
            return

        if( ! this.cursorSvg_ )
            return

        workspace
        .getCursor()
        ?.draw()
    }

    /**
     * Dispose of the marker manager.
     * Go through and delete all markers associated with this marker manager.
     *
     * @internal
     */

    dispose (){

        for ( const marker of this.markers.keys() )
            this.unregisterMarker(marker);

        this.markers.clear();

        if( ! this.cursor_ )
            return

        this.cursor_.dispose();
        this.cursor_ = null;
    }
}
