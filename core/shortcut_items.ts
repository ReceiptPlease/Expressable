
/**
 *  Registers default keyboard shortcuts.
 */

import { KeyboardShortcut , ShortcutRegistry } from './shortcut_registry.js'
import { BlockSvg } from './block_svg.js'
import { KeyCodes } from './utils/keycodes.js'
import { Gesture } from './gesture.js'

import type { WorkspaceSvg } from './workspace_svg.js'
import type { ICopyable } from './interfaces/i_copyable.js'

import * as clipboard from './clipboard.js'
import * as common from './common.js'


type Enum<Type> = ( Type )[ keyof Type ]


/**
 * Object holding the names of the default shortcut items.
 */

const Names = {
    Escape : 'escape' ,
    Delete : 'delete' ,
    Paste : 'paste' ,
    Copy : 'copy' ,
    Undo : 'undo' ,
    Redo : 'redo' ,
    Cut : 'cut'
} as const

export type Names =
    Enum<typeof Names>



interface KeyProps {
    modifiers : Array<KeyCodes> | null
    base : KeyCodes
}

const Key = ( props : KeyProps ) =>
    ShortcutRegistry.registry
        .createSerializedKey(props.base,props.modifiers);

const Variants = ( base : KeyCodes , modifiers : Array<KeyCodes> = [] ) => [
    Key({ base , modifiers : [ ... modifiers , KeyCodes.CTRL ] }) ,
    Key({ base , modifiers : [ ... modifiers , KeyCodes.ALT ] }) ,
    Key({ base , modifiers : [ ... modifiers , KeyCodes.META ] }) ,
]


/**
 *  Keyboard shortcut to hide chaff on escape.
 */

export function registerEscape (){

    const shortcut = <KeyboardShortcut> {

        keyCodes : [ KeyCodes.ESC ] ,
        name : Names.Escape ,

        preconditionFn : ( workspace ) =>
            ! workspace.options.readOnly ,

        callback : ( workspace : any ) =>
            ( workspace.hideChaff() , true )
    }

    ShortcutRegistry.registry
        .register(shortcut);
}


/**
 * Keyboard shortcut to delete a block on delete or backspace
 */

export function registerDelete (){

    const shortcut = <KeyboardShortcut> {

        keyCodes : [ KeyCodes.DELETE , KeyCodes.BACKSPACE ] ,
        name : Names.Delete ,

        preconditionFn ( workspace ){

            const selected = common
                .getSelected();

            return ! workspace.options.readOnly
                && selected != null
                && selected.isDeletable()
        },

        callback ( _ , event ){

            // Delete or backspace.
            // Stop the browser from going back to the previous page.
            // Do this first to prevent an error in the delete code from resulting in
            // data loss.

            event.preventDefault();

            // Don't delete while dragging.  Jeez.

            if( Gesture.inProgress() )
                return false;

            ( common.getSelected() as BlockSvg )
                .checkAndDelete();

            return true;
        },
    }

    ShortcutRegistry.registry
        .register(shortcut);
}


/**
 * Keyboard shortcut to copy a block on ctrl+c, cmd+c, or alt+c.
 */

export function registerCopy (){

    const shortcut = <KeyboardShortcut> {

        keyCodes : Variants(KeyCodes.C) ,
        name : Names.Copy ,

        preconditionFn ( workspace ){

            const selected = common
                .getSelected();

            return ! workspace.options.readOnly
                && ! Gesture.inProgress()
                && selected != null
                && selected.isDeletable()
                && selected.isMovable()
        },

        callback ( workspace : any , event ){

            // Prevent the default copy behavior, which may beep or otherwise indicate
            // an error due to the lack of a selection.

            event.preventDefault();

            // any because:  Property 'hideChaff' does not exist on
            // type 'Workspace'.

            workspace.hideChaff();

            clipboard.copy(common.getSelected() as ICopyable);

            return true
        }
    }

    ShortcutRegistry.registry
        .register(shortcut);
}


/**
 *  Keyboard shortcut to copy and delete a block on ctrl+x, cmd+x, or alt+x.
 */

export function registerCut (){

    const shortcut = <KeyboardShortcut> {

        keyCodes : Variants(KeyCodes.X) ,
        name : Names.Cut ,

        preconditionFn ( workspace ){

            const selected = common
                .getSelected();

            return ! workspace.options.readOnly
                && ! Gesture.inProgress()
                && selected != null
                && selected instanceof BlockSvg
                && selected.isDeletable()
                && selected.isMovable()
                && ! selected.workspace!.isFlyout;
        },

        callback (){

            const selected = common
                .getSelected();

            // Shouldn't happen but appeases the type system

            if( ! selected )
                return false

            clipboard
                .copy(selected);

            (selected as BlockSvg)
                .checkAndDelete();

            return true
        }
    }

    ShortcutRegistry.registry
        .register(shortcut);
}


/**
 *  Keyboard shortcut to paste a block on ctrl+v, cmd+v, or alt+v.
 */

export function registerPaste (){

    const shortcut = <KeyboardShortcut> {

        keyCodes : Variants(KeyCodes.V) ,
        name : Names.Paste ,

        preconditionFn : ( workspace ) =>
            ! workspace.options.readOnly &&
            ! Gesture.inProgress() ,

        callback : () =>
            !! clipboard.paste()
    }

    ShortcutRegistry.registry
        .register(shortcut);
}


/**
 *  Keyboard shortcut to undo the previous action on ctrl+z, cmd+z, or alt+z.
 */

export function registerUndo (){

    const shortcut = <KeyboardShortcut> {

        keyCodes : Variants(KeyCodes.Z) ,
        name : Names.Undo ,

        preconditionFn : ( workspace ) =>
            ! workspace.options.readOnly &&
            ! Gesture.inProgress() ,

        // 'z' for undo 'Z' is for redo.

        callback ( workspace : any ){
            workspace.hideChaff();
            workspace.undo(false);
            return true
        }
    }

    ShortcutRegistry.registry
        .register(shortcut);
}


/**
 *  Keyboard shortcut to redo the previous action on ctrl+shift+z, cmd+shift+z, or alt+shift+z.
 */

export function registerRedo (){

    const [ ctrl , alt , meta ] =
        Variants(KeyCodes.Z,[ KeyCodes.SHIFT ]);

    // Ctrl-y is redo in Windows.  Command-y is never valid on Macs.

    const ctrlY = Key({
        modifiers : [ KeyCodes.CTRL ] ,
        base : KeyCodes.Y
    });


    const shortcut = <KeyboardShortcut> {

        keyCodes : [ ctrl , alt , meta , ctrlY ] ,
        name : Names.Redo ,

        preconditionFn : ( workspace ) =>
            ! Gesture.inProgress() &&
            ! workspace.options.readOnly ,

        // 'z' for undo 'Z' is for redo.

        callback ( workspace : any ){

            workspace.hideChaff();
            workspace.undo(true);
            return true
        }
    }

    ShortcutRegistry.registry
        .register(shortcut);
}


/**
 * Registers all default keyboard shortcut item. This should be called once per
 * instance of KeyboardShortcutRegistry.
 *
 * @internal
 */

export function registerDefaultShortcuts (){
    registerEscape();
    registerDelete();
    registerCopy();
    registerCut();
    registerPaste();
    registerUndo();
    registerRedo();
}

registerDefaultShortcuts();
