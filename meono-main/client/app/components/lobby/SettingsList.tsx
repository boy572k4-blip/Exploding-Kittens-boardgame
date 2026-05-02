import {HTMLAttributes, useContext} from "react";
import ReactSwitch from "react-switch";
import {LocalStorageContext, useColyseusRoom, useColyseusState} from "../../utility/contexts";

/**
 * Displays game settings that can be changed if the player is the owner
 *
 * @param props
 * @constructor
 */
export default function SettingsList(props: HTMLAttributes<HTMLDivElement>) {
    let room = useColyseusRoom();
    let ownerId = useColyseusState((state) => state.ownerId);
    let isOwner = room ? room.sessionId === ownerId : false;
    let isImplodingEnabled = useColyseusState((state) => state.isImplodingEnabled) ?? true

    const {showTooltips, setShowTooltips} = useContext(LocalStorageContext);

    return (
        <div {...props}>
            <label className={"align-middle"}>Use Imploding Kittens?</label>
            <ReactSwitch checked={isImplodingEnabled} onChange={(checked) => {
                room && room.send("changeSettings", {isImplodingEnabled: checked, nopeQTECooldown: 3000})
            }} disabled={!isOwner} className={"align-middle ml-1 scale-75"} checkedIcon={false} uncheckedIcon={false}/>

            <hr className={"mt-3 mb-3 opacity-30"}/>

            <label className={"align-middle"}>Show card tooltips?</label>
            <ReactSwitch checked={showTooltips} onChange={(checked) => {
                setShowTooltips(checked);
            }} className={"align-middle ml-1 scale-75"} checkedIcon={false} uncheckedIcon={false}/>
        </div>
    )
}