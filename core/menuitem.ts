
import * as idGenerator from './utils/idgenerator.js'
import * as aria from './utils/aria.js'
import * as dom from './utils/dom.js'


type Handler = ( item : MenuItem ) => void


export class MenuItem {

    private actionHandler : Handler | null = null
    private roleName : aria.Role | null = null
    private element : HTMLDivElement | null = null

    private rightToLeft = false
    private highlight = false
    private checkable = false
    private checked = false
    private enabled = true


    /**
     *  @param content Text caption to display as the
     *  content of the item, or a HTML element to display.
     *
     *  @param opt_value Data / model associated with the menu item.
     */

    constructor(
        private readonly content : string | HTMLElement ,
        private readonly opt_value ?: string
    ) {}


    createDom (){

        const element = document
            .createElement('div');

        element.id = idGenerator
            .getNextUniqueId();

        this.element = element;


        const { classList } = element;

        classList.add('blocklyMenuItem');

        if( ! this.enabled )
            classList.add('blocklyMenuItemDisabled');

        if( this.checked )
            classList.add('blocklyMenuItemSelected');

        if( this.highlight )
            classList.add('blocklyMenuItemHighlight');

        if( this.rightToLeft )
            classList.add('blocklyMenuItemRtl');


        const content = document
            .createElement('div');

        content.className = 'blocklyMenuItemContent';


        if( this.checkable ){

            const checkbox = document
                .createElement('div');

            checkbox.className = 'blocklyMenuItemCheckbox';
            content.appendChild(checkbox);
        }


        let contentDom : Node = this.content as HTMLElement;

        if( typeof this.content === 'string' )
            contentDom = document
                .createTextNode(this.content);

        content.appendChild(contentDom);
        element.appendChild(content);


        if( this.roleName )
            aria.setRole(element,this.roleName);

        aria.setState(element,aria.State.SELECTED,this.checkable && this.checked);
        aria.setState(element,aria.State.DISABLED,! this.enabled);

        return element
    }


    dispose (){
        this.element = null;
    }


    getElement (){
        return this.element
    }


    getId (){
        return this.element!.id;
    }


    getValue (){
        return this.opt_value ?? null
    }


    setRightToLeft ( state : boolean ){
        this.rightToLeft = state;
    }


    setRole ( role : aria.Role ){
        this.roleName = role;
    }


    setCheckable ( checkable : boolean ){
        this.checkable = checkable;
    }


    setChecked ( checked : boolean ){
        this.checked = checked;
    }


    setHighlighted ( highlight : boolean ){

        this.highlight = highlight;

        const { element , enabled } = this;

        if( ! element )
            return

        if( ! enabled )
            return

        if( highlight )
            dom.addClass(element,'blocklyMenuItemHighlight');
        else
            dom.removeClass(element,'blocklyMenuItemHighlight');
    }


    isEnabled (){
        return this.enabled
    }


    setEnabled ( enabled : boolean ){
        this.enabled = enabled
    }


    performAction (){

        if ( ! this.enabled )
            return

        this.actionHandler?.(this);
    }


    onAction ( handler : Handler , object : object ){
        this.actionHandler = handler.bind(object);
    }
}
