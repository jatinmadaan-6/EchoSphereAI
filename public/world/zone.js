export const zones = [

    {
        id:"main-area",

        type:"proximity",

        bounds:{
            minX:-30,
            maxX:30,

            minZ:-30,
            maxZ:30
        }
    },


    {
        id:"meeting-room",

        type:"isolated",

        bounds:{
            minX:-5,
            maxX:5,

            minZ:-5,
            maxZ:5
        }
    }

];



export function getZone(position){

    for(const zone of zones){

        const inside =
            position.x >= zone.bounds.minX &&
            position.x <= zone.bounds.maxX &&
            position.z >= zone.bounds.minZ &&
            position.z <= zone.bounds.maxZ;


        if(inside){
            return zone;
        }

    }


    return null;

}