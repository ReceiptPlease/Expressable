
import { Coordinate } from './utils/coordinate.js'
import { KeyCodes } from './utils/keycodes.js'

import type { MenuItem } from './menuitem.js'
import type { Size } from './utils/size.js'

import * as browserEvents from './browser_events.js'
import * as style from './utils/style.js'
import * as aria from './utils/aria.js'
import * as dom from './utils/dom.js'


type Replace < Interface , Property > =
    Omit < Interface , keyof Property > & Property

type Target<Event,Target> = Replace<Event,{ target : Target }>



export class Menu {

    /**
     * Array of menu items.
     * (Nulls are never in the array, but typing the array as nullable prevents
     * the compiler from objecting to .indexOf(null))
     */

    private readonly menuItems : MenuItem[] = []

    /**
     * Coordinates of the mousedown event that caused this menu to open. Used to
     * prevent the consequent mouseup event due to a simple click from
     * activating a menu item immediately.
     */

    openingCoords : Coordinate | null = null

    private mouseEnterHandler : browserEvents.Data | null = null
    private mouseLeaveHandler : browserEvents.Data | null = null
    private onKeyDownHandler : browserEvents.Data | null = null
    private mouseOverHandler : browserEvents.Data | null = null
    private clickHandler : browserEvents.Data | null = null

    private highlightedItem : MenuItem | null = null
    private roleName : aria.Role | null = null
    private element : HTMLDivElement | null = null


    constructor () {}


    addChild ( item : MenuItem ){
        this.menuItems.push(item);
    }



    render ( container : Element ){

        const element = document
            .createElement('div');

        element.className = 'blocklyMenu blocklyNonSelectable';
        element.tabIndex = 0;


        if( this.roleName )
            aria.setRole(element,this.roleName);


        this.element = element;


        for ( const item of this.menuItems )
            element.appendChild(item.createDom());


        this.mouseOverHandler = browserEvents
            .conditionalBind(element,'pointerover',this,this.handleMouseOver,true);

        this.clickHandler = browserEvents
            .conditionalBind(element,'pointerdown',this,this.handleClick,true);

        this.mouseEnterHandler = browserEvents
            .conditionalBind(element,'pointerenter',this,this.handleMouseEnter,true);

        this.mouseLeaveHandler = browserEvents
            .conditionalBind(element,'pointerleave',this,this.handleMouseLeave,true);

        this.onKeyDownHandler = browserEvents
            .conditionalBind(element,'keydown',this,this.handleKeyEvent);

        container.appendChild(element);

        return element
    }


    get isEmpty (){
        return this.menuItems.length < 1
    }


    getElement (){
        return this.element
    }


    focus (){

        const { element } = this;

        if( ! element )
            return

        element.focus({ preventScroll : true });
        dom.addClass(element,'blocklyFocused');
    }


    private blur (){

        const { element } = this;

        if( ! element )
            return

        element.blur();
        dom.removeClass(element,'blocklyFocused');
    }


    setRole ( role : aria.Role ){
        this.roleName = role
    }


    dispose (){

        if( this.mouseEnterHandler )
            browserEvents.unbind(this.mouseEnterHandler);

        if( this.mouseLeaveHandler )
            browserEvents.unbind(this.mouseLeaveHandler);

        if( this.mouseOverHandler )
            browserEvents.unbind(this.mouseOverHandler);

        if( this.onKeyDownHandler )
            browserEvents.unbind(this.onKeyDownHandler);

        if( this.clickHandler )
            browserEvents.unbind(this.clickHandler);

        this.mouseEnterHandler = null;
        this.mouseLeaveHandler = null;
        this.onKeyDownHandler = null;
        this.mouseOverHandler = null;
        this.clickHandler = null;


        for ( const item of this.menuItems )
            item.dispose();

        this.element = null;
    }


    /**
     * Returns the child menu item that owns the given DOM element,
     * or null if no such menu item is found.
     *
     * @param child DOM element whose owner is to be returned.
     * @returns Menu item for which the DOM element belongs to.
     */

    private getMenuItem ( child : Element ){

        const { element } = this;


        // Node might be the menu border (resulting in no associated menu item), or
        // a menu item's div, or some element within the menu item.
        // Walk up parents until one meets either the menu's root element, or
        // a menu item's div.

        let current : Element | null = child;

        while ( current && current !== element ){

            // Having found a menu item's div, locate that menu item in this menu.

            if( current.classList.contains('blocklyMenuItem') )
                for ( const item of this.menuItems )
                    if( item.getElement() === current )
                        return item

            current = current.parentElement;
        }

        return null
    }


    setHighlighted ( item : MenuItem | null ){

        this.highlightedItem
            ?.setHighlighted(false);

        this.highlightedItem = null;

        if( ! item )
            return

        item.setHighlighted(true);

        this.highlightedItem = item;

        // Bring the highlighted item into view. This has no effect if the menu is
        // not scrollable.

        const element = this.getElement() as Element;

        style.scrollIntoContainerView(item.getElement() as Element,element);
        aria.setState(element,aria.State.ACTIVEDESCENDANT,item.getId());
    }


    highlightNext (){

        let index = -1;

        if( this.highlightedItem )
            index = this.menuItems
                .indexOf(this.highlightedItem);

        this.highlightHelper(index,1);
    }


    highlightPrevious (){

        let index = -1;

        if( this.highlightedItem )
            index = this.menuItems
                .indexOf(this.highlightedItem);

        if( index < 0 )
            index = this.menuItems.length;

        this.highlightHelper(index,-1);
    }


    private highlightFirst (){
        this.highlightHelper(-1,1);
    }


    private highlightLast (){
        this.highlightHelper(this.menuItems.length,-1);
    }


    /**
     * Helper function that manages the details of moving the highlight among
     * child menuitems in response to keyboard events.
     *
     * @param startIndex Start index.
     * @param delta Step direction: 1 to go down, -1 to go up.
     */

    private highlightHelper ( startIndex : number , delta : number ){

        let index = startIndex + delta;
        let menuItem;

        while ( menuItem = this.menuItems[index] ){

            if( menuItem.isEnabled() ){
                this.setHighlighted(menuItem);
                break
            }

            index += delta;
        }
    }


    private handleMouseOver ( event : Target<PointerEvent,Element> ){

        const { target } = event ;

        const menuItem = this
            .getMenuItem(target);

        if( ! menuItem )
            return

        if( menuItem.isEnabled() ){

            if (this.highlightedItem !== menuItem)
                this.setHighlighted(menuItem)

        } else {
            this.setHighlighted(null);
        }
    }


    private handleClick ( event : Target<PointerEvent,Element> ){

        const { openingCoords } = this;

        // Clear out the saved opening coords immediately so they're not used twice.

        this.openingCoords = null;

        const { clientX , clientY } = event;

        if( openingCoords && typeof clientX === 'number' ){

            const coordinates = new Coordinate(clientX,clientY);

            // This menu was opened by a mousedown and we're handling the consequent
            // click event. The coords haven't changed, meaning this was the same
            // opening event. Don't do the usual behavior because the menu just
            // popped up under the mouse and the user didn't mean to activate this
            // item.

            if( Coordinate.distance(openingCoords,coordinates) < 1 )
                return
        }

        this
        .getMenuItem(event.target)
        ?.performAction();
    }


    private handleMouseEnter ( _ : PointerEvent ){
        this.focus();
    }


    private handleMouseLeave ( _ : PointerEvent ){

        if( ! this.element )
            return

        this.blur();
        this.setHighlighted(null);
    }


    private handleKeyEvent ( event : KeyboardEvent ){

        if( this.isEmpty )
            return

        if( event.shiftKey )
            return

        if( event.ctrlKey )
            return

        if( event.metaKey )
            return

        if( event.altKey )
            return


        switch( event.keyCode ){

        case KeyCodes.ENTER :
        case KeyCodes.SPACE :

            this.highlightedItem
                ?.performAction();

            break

        case KeyCodes.UP :
            this.highlightPrevious();
            break

        case KeyCodes.DOWN :
            this.highlightNext();
            break

        case KeyCodes.PAGE_UP :
        case KeyCodes.HOME :
            this.highlightFirst();
            break

        case KeyCodes.PAGE_DOWN :
        case KeyCodes.END :
            this.highlightLast();
            break

        default : return

        }

        event.stopPropagation();
        event.preventDefault();
    }


    /**
     *  Rendered Size
     */

    getSize (){

        const menuDom = this
            .getElement() as HTMLDivElement;

        const menuSize = style
            .getSize(menuDom);

        // Recalculate height for the total content, not only box height.

        menuSize.height = menuDom.scrollHeight;

        return menuSize
    }
}
