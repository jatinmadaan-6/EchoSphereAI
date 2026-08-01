export function canHear(listener, speaker){

    if(
        !listener ||
        !speaker
    ){
        return false;
    }


    // Same zone always allowed
    if(
        listener.zoneId === speaker.zoneId
    ){
        return true;
    }


    // Different zones blocked
    return false;

}