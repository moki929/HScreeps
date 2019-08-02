// reset for v2:
Memory.MemRooms = {};
Memory.buyOrdersHistory = {};
for(const creepName in Memory.creeps) {
    const gc = Game.creeps[creepName];
    const mc = Memory.creeps[creepName];
    if(gc === undefined){
        delete Memory.creeps[creepName];
    }else{
        mc.transferring = undefined;
        mc.JobName = "idle";
        mc.EnergySupply = undefined;
        mc.EnergySupplyType = undefined;
        //gc.suicide(); // total reset
    }
}
console.log("manual search: " + JSON.stringify(Game.getObjectById("5cee5f96d1936f6f4667aa35")))