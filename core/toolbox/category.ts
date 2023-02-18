
import { ToolboxItem } from './toolbox_item.js'

import type { CategoryInfo , DynamicCategoryInfo , FlyoutDefinition , FlyoutItemInfo , FlyoutItemInfoArray , StaticCategoryInfo } from '../utils/toolbox.js'
import type { ICollapsibleToolboxItem } from '../interfaces/i_collapsible_toolbox_item.js'
import type { ISelectableToolboxItem } from '../interfaces/i_selectable_toolbox_item.js'
import type { IToolboxItem } from '../interfaces/i_toolbox_item.js'
import type { IToolbox } from '../interfaces/i_toolbox.js'

import * as colourUtils from '../utils/colour.js'
import * as registry from '../registry.js'
import * as parsing from '../utils/parsing.js'
import * as toolbox from '../utils/toolbox.js'
import * as aria from '../utils/aria.js'
import * as Css from '../css.js'
import * as dom from '../utils/dom.js'


export
class ToolboxCategory
extends ToolboxItem
implements ISelectableToolboxItem {

    /** Name used for registering a toolbox category. */
    static registrationName = 'category';

    /** The number of pixels to move the category over at each nested level. */
    static nestedPadding = 19;

    /** The width in pixels of the strip of colour next to each category. */
    static borderWidth = 8;

    /**
     * The default colour of the category. This is used as the background colour
     * of the category when it is selected.
     */
    static defaultBackgroundColour = '#57e';

    // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
    override toolboxItemDef_!: CategoryInfo;

    /** The name that will be displayed on the category. */
    protected name_ = '';

    /** The colour of the category. */
    protected colour_ = '';

    /** The html container for the category. */
    protected htmlDiv_: HTMLDivElement|null = null;

    /** The html element for the category row. */
    protected rowDiv_: HTMLDivElement|null = null;

    /** The html element that holds children elements of the category row. */
    protected rowContents_: HTMLDivElement|null = null;

    /** The html element for the toolbox icon. */
    protected iconDom_: Element|null = null;

    /** The html element for the toolbox label. */
    protected labelDom_: Element|null = null;
    protected cssConfig_: CssConfig;

    /** True if the category is meant to be hidden, false otherwise. */
    protected isHidden_ = false;

    /** True if this category is disabled, false otherwise. */
    protected isDisabled_ = false;

    /** The flyout items for this category. */
    protected flyoutItems_: string|FlyoutItemInfoArray = [];


    /**
     * @param categoryDef The information needed to create a category in the
     *     toolbox.
     * @param parentToolbox The parent toolbox for the category.
     * @param opt_parent The parent category or null if the category does not have
     *     a parent.
     */

    constructor(
        categoryDef : CategoryInfo ,
        parentToolbox : IToolbox ,
        opt_parent ?: ICollapsibleToolboxItem
    ){

        super(categoryDef,parentToolbox,opt_parent);

        /** All the css class names that are used to create a category. */
        this.cssConfig_ = this.makeDefaultCssConfig_();
    }


    /**
     * Initializes the toolbox item.
     * This includes creating the DOM and updating the state of any items based
     * on the info object.
     * Init should be called immediately after the construction of the toolbox
     * item, to ensure that the category contents are properly parsed.
     */

    override init (){

        const { toolboxItemDef_ } = this;

        this.parseCategoryDef_(toolboxItemDef_);
        this.parseContents_(toolboxItemDef_);
        this.createDom_();

        if( toolboxItemDef_.hidden === 'true' )
            this.hide();
    }


    /**
     * Creates an object holding the default classes for a category.
     *
     * @returns The configuration object holding all the CSS classes for a
     *     category.
     */

    protected makeDefaultCssConfig_ (){
        return {
            rowcontentcontainer : 'blocklyTreeRowContentContainer' ,
            closedicon : 'blocklyTreeIconClosed' ,
            container : 'blocklyToolboxCategory' ,
            contents : 'blocklyToolboxContents' ,
            selected : 'blocklyTreeSelected' ,
            openicon : 'blocklyTreeIconOpen' ,
            label : 'blocklyTreeLabel' ,
            icon : 'blocklyTreeIcon' ,
            row : 'blocklyTreeRow'
        }
    }


    /**
     * Parses the contents array depending on if the category is a dynamic
     * category, or if its contents are meant to be shown in the flyout.
     *
     * @param category The information needed to create a category.
     */

    protected parseContents_ ( category : CategoryInfo ){

        if( 'custom' in category ){
            this.flyoutItems_ = category.custom;
            return
        }


        const { contents } = category;

        if( ! contents )
            return


        const { flyoutItems_ } = this;

        if( ! Array.isArray(flyoutItems_) )
            return


        flyoutItems_.push( ... <FlyoutItemInfo[]> contents );
    }


    protected parseCategoryDef_ ( category : CategoryInfo ){

        this.name_ = '';

        if( 'name' in category )
            this.name_ = parsing.replaceMessageReferences(category.name);

        this.colour_ = this
            .getColour_(category);

        const config = category.cssconfig
            ?? (category as any).cssConfig;

        Object.assign(this.cssConfig_,config);
    }


    protected createDom_ (){

        this.htmlDiv_ = this.createContainer_();

        aria.setState(this.htmlDiv_,aria.State.SELECTED,false);
        aria.setState(this.htmlDiv_,aria.State.LEVEL,this.level_);
        aria.setRole(this.htmlDiv_,aria.Role.TREEITEM);

        this.rowDiv_ = this.createRowContainer_();
        this.rowDiv_.style.pointerEvents = 'auto';
        this.htmlDiv_.appendChild(this.rowDiv_);

        this.rowContents_ = this.createRowContentsContainer_();
        this.rowContents_.style.pointerEvents = 'none';
        this.rowDiv_.appendChild(this.rowContents_);

        this.iconDom_ = this.createIconDom_();
        aria.setRole(this.iconDom_, aria.Role.PRESENTATION);
        this.rowContents_.appendChild(this.iconDom_);

        this.labelDom_ = this.createLabelDom_(this.name_);
        this.rowContents_.appendChild(this.labelDom_);

        const id = this.labelDom_.getAttribute('id');

        if( id )
            aria.setState(this.htmlDiv_,aria.State.LABELLEDBY,id);

        this.addColourBorder_(this.colour_);

        return this.htmlDiv_
    }


    protected createContainer_ (){

        const container = document
            .createElement('div');

        const className = this.cssConfig_.container;

        if( className )
            dom.addClass(container,className);

        return container
    }


    protected createRowContainer_ (){

        const rowDiv = document
            .createElement('div');

        const className = this.cssConfig_.row;

        if( className )
            dom.addClass(rowDiv,className);

        let padding = ToolboxCategory
            .nestedPadding * this.getLevel();

        const nestedPadding = `${ padding }px`;

        const { style } = rowDiv;

        if( this.workspace_.RTL )
            style.paddingRight = nestedPadding;
        else
            style.paddingLeft = nestedPadding;

        return rowDiv
    }


    protected createRowContentsContainer_ (){

        const contentsContainer = document
            .createElement('div');

        const className = this.cssConfig_
            .rowcontentcontainer;

        if( className )
            dom.addClass(contentsContainer,className);

        return contentsContainer
    }


    protected createIconDom_ (){

        const icon = document
            .createElement('span');

        if( ! this.parentToolbox_.isHorizontal() ){

            const className = this.cssConfig_.icon;

            if( className )
                dom.addClass(icon,className);
        }

        icon.style.display = 'inline-block';

        return icon
    }


    protected createLabelDom_ ( name : string ){

        const label = document
            .createElement('span');

        const id = `${ this.getId() }.label`;

        label.setAttribute('id',id);
        label.textContent = name;

        const className = this.cssConfig_.label;

        if( className )
            dom.addClass(label,className);

        return label
    }


    refreshTheme (){
        this.colour_ = this.getColour_(this.toolboxItemDef_);
        this.addColourBorder_(this.colour_);
    }


    protected addColourBorder_ ( color : string ){

        if( ! color )
            return

        color ||= '#DDD';

        const border = `${ ToolboxCategory.borderWidth }px solid ${ color }`;

        const { style } = this.rowDiv_ as HTMLDivElement;

        if( this.workspace_.RTL )
            style.borderRight = border;
        else
            style.borderLeft = border;
    }


    /**
     * Gets either the colour or the style for a category.
     *
     * @param category The object holding information on the category.
     * @returns The hex colour for the category.
     */

    protected getColour_ ( category : CategoryInfo ){

        const styleName = category.categorystyle
            ?? (category as any).categoryStyle;

        const { colour } = category;

        if( colour && styleName ){

            console.warn(
                `Toolbox category '${ this.name_ }' must
                 not have both a style and a colour`);

            return ''
        }

        if( styleName )
            return this.getColourfromStyle_(styleName)

        if( colour )
            return this.parseColour_(colour)

        return ''
    }


    /**
     * Sets the colour for the category using the style name and returns the new
     * colour as a hex string.
     *
     * @param name Name of the style.
     * @returns The hex colour for the category.
     */

    private getColourfromStyle_ ( name : string ){

        if( ! name )
            return ''

        const theme = this.workspace_
            .getTheme();

        if( ! theme )
            return ''

        const { colour } = theme.categoryStyles[name] ?? {};

        if( colour )
            return this.parseColour_(colour);

        console.warn(
            `Style '${ name }' must exist
             and contain a colour value`);

        return ''
    }


    /**
     * Gets the HTML element that is clickable.
     * The parent toolbox element receives clicks. The parent toolbox will add an
     * ID to this element so it can pass the onClick event to the correct
     * toolboxItem.
     *
     * @returns The HTML element that receives clicks.
     */

    override getClickTarget (){
        return this.rowDiv_ as Element;
    }


    /**
     * Parses the colour on the category.
     *
     * @param value HSV hue value (0 to 360), #RRGGBB string, or a message
     *     reference string pointing to one of those two values.
     * @returns The hex colour for the category.
     */

    private parseColour_ ( value : number | string ){

        // Decode the colour for any potential message references
        // (eg. `%{BKY_MATH_HUE}`).

        const color = parsing.replaceMessageReferences(value);

        if( color == null )
            return ''

        if( color === '' )
            return ''

        const hue = Number(color);

        if( ! isNaN(hue) )
            return colourUtils.hueToHex(hue)

        const hex = colourUtils.parse(color);

        if( hex )
            return hex

        console.warn(
            `Toolbox category '${ this.name_ }' has an
             unrecognized color attribute: ${ color }`);

        return ''
    }


    protected openIcon_ ( iconDiv : Element | null ){

        if( ! iconDiv )
            return

        const closedIconClass = this.cssConfig_['closedicon'];

        if( closedIconClass )
            dom.removeClasses(iconDiv,closedIconClass);

        const className = this.cssConfig_['openicon'];

        if( className )
            dom.addClass(iconDiv,className);
    }


    protected closeIcon_ ( iconDiv : Element | null ){

        if( ! iconDiv )
            return;

        const openIconClass = this.cssConfig_['openicon'];

        if( openIconClass )
            dom.removeClasses(iconDiv,openIconClass);

        const className = this.cssConfig_['closedicon'];

        if( className )
            dom.addClass(iconDiv,className);
    }


    override setVisible_ ( isVisible : boolean ){

        this.htmlDiv_!.style.display = isVisible
            ? 'block'
            : 'none' ;

        this.isHidden_ = ! isVisible;

        const { parentToolbox_ } = this;

        if( parentToolbox_.getSelectedItem() === this)
            parentToolbox_.clearSelection();
    }


    hide() {
        this.setVisible_(false);
    }


    show (){
        this.setVisible_(true);
    }


    isVisible (){
        return ! this.isHidden_
            && this.allAncestorsExpanded_()
    }


    protected allAncestorsExpanded_ (){

        let category : IToolboxItem | null = this;

        while ( category = category.getParent() )
            if( ! (category as ICollapsibleToolboxItem).isExpanded )
                return false

        return true
    }

    override isSelectable (){
        return this.isVisible()
            && ! this.isDisabled_
    }


    onClick ( _event : Event ) {}


    setSelected ( isSelected : boolean ){

        if( ! this.rowDiv_ )
            return

        const className = this.cssConfig_['selected'];

        if( isSelected ){

            const defaultColour =
                this.parseColour_(ToolboxCategory.defaultBackgroundColour);

            this.rowDiv_.style.backgroundColor =
                this.colour_ ?? defaultColour;

            if( className )
                dom.addClass(this.rowDiv_,className);

        } else {

            this.rowDiv_.style.backgroundColor = '';

            if( className )
                dom.removeClass(this.rowDiv_,className);
        }

        aria.setState(
            this.htmlDiv_ as Element ,
            aria.State.SELECTED ,
            isSelected
        );
    }


    setDisabled ( isDisabled : boolean ){

        this.isDisabled_ = isDisabled;

        const div = this.getDiv();

        div!.setAttribute('disabled',`${ isDisabled }`);

        if( isDisabled )
            div!.setAttribute('disabled','true');
        else
            div!.removeAttribute('disabled');
    }


    getName (){
        return this.name_
    }

    override getParent (){
        return this.parent_
    }

    override getDiv (){
        return this.htmlDiv_
    }

    getContents (){
        return this.flyoutItems_
    }

    /**
    * Updates the contents to be displayed in the flyout.
    * If the flyout is open when the contents are updated, refreshSelection on
    * the toolbox must also be called.
    *
    * @param contents The contents to be displayed in the flyout. A string can be
    *     supplied to create a dynamic category.
    */
    updateFlyoutContents(contents: FlyoutDefinition|string) {
    this.flyoutItems_ = [];

    if (typeof contents === 'string') {
        const newDefinition: DynamicCategoryInfo = {
        kind: this.toolboxItemDef_.kind,
        custom: contents,
        id: this.toolboxItemDef_.id,
        categorystyle: this.toolboxItemDef_.categorystyle,
        colour: this.toolboxItemDef_.colour,
        cssconfig: this.toolboxItemDef_.cssconfig,
        hidden: this.toolboxItemDef_.hidden,
        };
        this.toolboxItemDef_ = newDefinition;
    } else {
        const newDefinition: StaticCategoryInfo = {
        kind: this.toolboxItemDef_.kind,
        name: 'name' in this.toolboxItemDef_ ? this.toolboxItemDef_['name'] :
                                                '',
        contents: toolbox.convertFlyoutDefToJsonArray(contents),
        id: this.toolboxItemDef_.id,
        categorystyle: this.toolboxItemDef_.categorystyle,
        colour: this.toolboxItemDef_.colour,
        cssconfig: this.toolboxItemDef_.cssconfig,
        hidden: this.toolboxItemDef_.hidden,
        };
        this.toolboxItemDef_ = newDefinition;
    }
    this.parseContents_(this.toolboxItemDef_);
    }

    override dispose (){
        dom.removeNode(this.htmlDiv_);
    }
}


export namespace ToolboxCategory {

    /** All the CSS class names that are used to create a category. */

    export interface CssConfig {

        rowcontentcontainer ?: string
        closedicon ?: string
        container ?: string
        contents ?: string
        openicon ?: string
        selected ?: string
        label ?: string
        icon ?: string
        row ?: string
    }
}


export type CssConfig = ToolboxCategory.CssConfig;


Css.register(`

    .blocklyTreeRow:not( .blocklyTreeSelected ):hover {
        background-color : rgba( 255 , 255 , 255 , .2 );
    }

    .blocklyToolboxDiv[ layout = 'h' ] .blocklyToolboxCategory {
        margin : 1px 5px 1px 0 ;
    }

    .blocklyToolboxDiv[ dir = 'RTL' ][ layout = 'h' ] .blocklyToolboxCategory {
        margin : 1px 0 1px 5px ;
    }

    .blocklyTreeRow {

        height : 22px ;

        padding-right : 8px ;
        margin-bottom : 3px ;

        white-space : nowrap ;
        line-height : 22px ;
    }

    .blocklyToolboxDiv[ dir = 'RTL' ] .blocklyTreeRow {
        padding-right : 0 ;
        margin-left : 8px ;
    }

    .blocklyTreeIcon {

        background-image : url(<<<PATH>>>/sprites.png) ;

        vertical-align : middle ;
        visibility : hidden ;

        height : 16px ;
        width : 16px ;
    }

    .blocklyTreeIconClosed {
        background-position : -32px -1px ;
    }

    .blocklyToolboxDiv[ dir = 'RTL' ] .blocklyTreeIconClosed {
        background-position : 0 -1px ;
    }

    .blocklyTreeSelected > .blocklyTreeIconClosed {
        background-position : -32px -17px ;
    }

    .blocklyToolboxDiv[ dir = 'RTL' ] .blocklyTreeSelected > .blocklyTreeIconClosed {
        background-position : 0 -17px ;
    }

    .blocklyTreeIconOpen {
        background-position : -16px -1px ;
    }

    .blocklyTreeSelected > .blocklyTreeIconOpen {
        background-position : -16px -17px ;
    }

    .blocklyTreeLabel {

        vertical-align : middle ;
        padding : 0 3px ;
        cursor : default ;
        font : 16px sans-serif ;
    }

    .blocklyToolboxDelete .blocklyTreeLabel {
        cursor : url("<<<PATH>>>/handdelete.cur") , auto ;
    }

    .blocklyTreeSelected .blocklyTreeLabel {
        color : #fff ;
    }
`);


registry.register(
    registry.Type.TOOLBOX_ITEM ,
    ToolboxCategory.registrationName ,
    ToolboxCategory
);
