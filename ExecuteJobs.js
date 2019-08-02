const ExecuteJobs = {
    run: function () {
        // jobs have been created
        // creeps where assigned
        // check if creep on job is dead then set job to vacant - one room at a time - one job at a time
            // if creep alive then execute the job
            // after execution - check if job is done
                // if job is done then set creep to idle and remove job from memory

        const ERR_NO_RESULT_FOUND = -20; // job flow did not encounter any actions that lead to any results!
        const JOB_IS_DONE = -21; // when the job should be removed but there are no ERR codes
        const JOB_OBJ_DISAPPEARED = -22; // getObjectById returned null

        ExecuteRoomJobs();

        function ExecuteRoomJobs(){
            for(const creepName in Memory.creeps) {
                const creepMemory = Memory.creeps[creepName];
                const gameCreep = Game.creeps[creepName];
                if(!gameCreep && creepMemory.JobName === 'idle'){ // idle creep is dead
                    console.log('ExecuteJobs ExecuteRoomJobs idle creep ' + creepName + ' has died');
                    delete Memory.creeps[creepName];
                    continue;
                }else if(creepMemory.JobName === 'idle'){
                    // TODO - idle actions to be added here
                    continue;
                }
                const roomName = creepMemory.JobName.split(')').pop();
                const job = Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName];

                if(job === undefined){ // job is outdated and removed from Memory
                    console.log('ExecuteJobs ExecuteRoomJobs job gone ' + creepName + ' in' + roomName + ' job ' + creepMemory.JobName);
                    creepMemory.JobName = 'idle';
                }else if(!gameCreep){ // creep is dead
                    console.log('ExecuteJobs ExecuteRoomJobs ' + creepName + ' on ' + creepMemory.JobName + ' in ' + roomName + ' has died');
                    const tombstone = Game.rooms[roomName].find(FIND_TOMBSTONES, {filter: function(tombstone) {return tombstone.creep.name === creepName;}})[0];
                    if(tombstone){
                        new RoomVisual(roomName).text(creepName + '⚰', tombstone.pos.x, tombstone.pos.y);
                    }
                    job.Creep = 'vacant';
                    delete Memory.creeps[creepName];
                }else if(job.Creep !== 'vacant') { // creep is alive and its job is found
                    const isJobDone = JobAction(gameCreep, job, creepMemory.JobName);
                    if(isJobDone){
                        delete Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName];
                        creepMemory.JobName = 'idle';
                    }
                }
            }
        }

        /**@return {boolean}*/
        function JobAction(creep, roomJob, jobKey){
            let result = ERR_NO_RESULT_FOUND;
            switch (true) {
                // obj jobs
                case jobKey.startsWith('Source'):
                    result = JobSource(creep, roomJob);
                    break;
                case jobKey.startsWith('Controller'):
                    result = JobController(creep, roomJob); // uses JobEnergyAction()
                    break;
                case jobKey.startsWith('Repair'):
                    result = JobRepair(creep, roomJob); // uses JobEnergyAction()
                    break;
                case jobKey.startsWith('Construction'):
                    result = JobConstruction(creep, roomJob); // uses JobEnergyAction()
                    break;
                case jobKey.startsWith('FillSpawnExtension'):
                    result = JobFillSpawnExtension(creep, roomJob); // uses JobEnergyAction()
                    break;
                case jobKey.startsWith('FillTower'):
                    result = JobFillTower(creep, roomJob); // uses JobEnergyAction()
                    break;
                case jobKey.startsWith('FillStorage'):
                    result = JobFillStorage(creep, roomJob);
                    break;
                case jobKey.startsWith('ExtractMineral'):
                    result = JobExtractMineral(creep, roomJob);
                    break;

                // flag jobs
                case jobKey.startsWith('TagController'):
                    result = JobTagController(creep, roomJob);
                    break;
                case jobKey.startsWith('ScoutPos'):
                    result = JobScoutPos(creep, roomJob);
                    break;
                case jobKey.startsWith('ClaimController'):
                    result = JobClaimController(creep, roomJob);
                    break;
                case jobKey.startsWith('ReserveController'):
                    result = JobReserveController(creep, roomJob);
                    break;
                case jobKey.startsWith('GuardPos'):
                    result = JobGuardPos(creep, roomJob);
                    break;
                default:
                    console.log('ExecuteJobs JobAction ERROR! job not found ' + jobKey + ' ' + creep.name);
            }
            let isJobDone = false;
            if(result === OK){
                // job is done everyone is happy, nothing to do.
            }else if(result === ERR_TIRED){
                creep.say('😪 ' + creep.fatigue);
            }else if(result === ERR_BUSY){
                // The creep is still being spawned
            }else{ // results where anything else than OK - one should end the job!
                if(result === ERR_NO_RESULT_FOUND){
                    console.log('ExecuteJobs JobAction ERROR! no result gained ' + jobKey + ' ' + result + ' ' + creep.name);
                    creep.say('⚠ ' + result);
                }else if(result === JOB_OBJ_DISAPPEARED){
                    console.log('ExecuteJobs JobAction removing disappeared job ' + jobKey + ' ' + result + ' ' + roomJob.Creep + ' ' + JSON.stringify(roomJob));
                    creep.say('🙈 ' + result);
                }else{
                    console.log('ExecuteJobs JobAction removing ' + jobKey + ' ' + result + ' ' + roomJob.Creep + ' ' + JSON.stringify(roomJob));
                    creep.say('✔ ' + result);
                }
                isJobDone = true;
            }
            if(creep.carry[RESOURCE_ENERGY] > 0){
                const toFill = creep.pos.findInRange(FIND_MY_STRUCTURES, 1, {filter: (structure) => {
                        return (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) && structure.energy < structure.energyCapacity;
                    }})[0];
                if(toFill){
                    creep.transfer(toFill, RESOURCE_ENERGY);
                    console.log('ExecuteJobs JobAction ' + creep.name + ' transferred energy to adjacent spawn or extension (' + toFill.pos.x + ',' + toFill.pos.y + ',' + toFill.pos.roomName + ')');
                }
            }
            return isJobDone;
        }

        // obj jobs:

        /**@return {int}*/
        function JobSource(creep, roomJob){
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);
            if(obj === null){
                result = JOB_OBJ_DISAPPEARED;
            }else if(_.sum(creep.carry) < creep.carryCapacity){
                result = creep.harvest(obj);
                if(result === ERR_NOT_IN_RANGE){
                    result = creep.moveTo(obj, {visualizePathStyle:{fill: 'transparent',stroke: '#ffe100',lineStyle: 'undefined',strokeWidth: .15,opacity: .5}});
                }
            }else{
                const link = obj.pos.findInRange(FIND_MY_STRUCTURES, 2, {filter: function(link) { return link.structureType === STRUCTURE_LINK && link.energy < link.energyCapacity;}})[0];
                if(link && creep.carry[RESOURCE_ENERGY] === creep.carryCapacity){
                    result = creep.transfer(link, RESOURCE_ENERGY);
                }else{
                    const container = obj.pos.findInRange(FIND_MY_STRUCTURES, 1, {filter: function(container) { return container.structureType === STRUCTURE_CONTAINER && _.sum(container.store) < container.storeCapacity;}})[0];
                    if(container){
                        result = creep.transfer(link, RESOURCE_ENERGY);
                    }else{
                        for(const resourceType in creep.carry) {
                            result = creep.drop(resourceType);
                        }
                    }
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobController(creep, roomJob){
            const obj = Game.getObjectById(roomJob.JobId);
            const result = JobEnergyAction(creep, roomJob, obj, {creepAction: function() {return creep.upgradeController(obj, RESOURCE_ENERGY);}});
            return result;
        }

        /**@return {int}*/
        function JobRepair(creep, roomJob){
            const obj = Game.getObjectById(roomJob.JobId);
            const result = JobEnergyAction(creep, roomJob, obj, {creepAction: function() {return creep.repair(obj, RESOURCE_ENERGY);}});
            return result;
        }

        /**@return {int}*/
        function JobConstruction(creep, roomJob){
            const obj = Game.getObjectById(roomJob.JobId);
            const result = JobEnergyAction(creep, roomJob, obj, {creepAction: function() {return creep.build(obj, RESOURCE_ENERGY);}});
            return result;
        }

        /**@return {int}*/
        function JobFillSpawnExtension(creep, roomJob){
            const obj = Game.getObjectById(roomJob.JobId);
            const result = JobEnergyAction(creep, roomJob, obj, {creepAction: function() {return creep.transfer(obj, RESOURCE_ENERGY);}});
            return result;
        }

        /**@return {int}*/
        function JobFillTower(creep, roomJob){
            const obj = Game.getObjectById(roomJob.JobId);
            const result = JobEnergyAction(creep, roomJob, obj, {creepAction: function() {return creep.transfer(obj, RESOURCE_ENERGY);}});
            return result;
        }

        /**@return {int}*/
        function JobFillStorage(creep, roomJob){
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);
            if(obj === null){
                result = JOB_OBJ_DISAPPEARED;
            }else if(_.sum(creep.carry) < creep.carryCapacity && !creep.memory.Transferring){ // fill creep
                if(obj.structureType === STRUCTURE_CONTAINER){
                    for (const resourceType in obj.store) {
                        result = creep.withdraw(obj, resourceType);
                    }
                }else if(obj.resourceType !== undefined){ // drop
                    result = creep.pickup(obj);
                }else{ // link
                    result = creep.withdraw(obj, RESOURCE_ENERGY);
                }
                if(result === ERR_NOT_IN_RANGE){
                    result = creep.moveTo(obj, {visualizePathStyle:{fill: 'transparent',stroke: '#00f5ff',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                }else if((result === ERR_NOT_ENOUGH_RESOURCES) && _.sum(creep.carry) > 0){
                    result = OK;
                    creep.memory.Transferring = true;
                }
            }else if(_.sum(creep.carry) > 0){ // empty creep
                for(const resourceType in creep.carry) {
                    result = creep.transfer(obj.room.storage, resourceType);
                }
                if(result === ERR_NOT_IN_RANGE){
                    result = creep.moveTo(obj.room.storage, {visualizePathStyle:{fill: 'transparent',stroke: '#0048ff',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                }
                if(_.sum(creep.carry) > 0){
                    creep.memory.Transferring = true;
                }else{
                    creep.memory.Transferring = false;
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobExtractMineral(creep, roomJob){
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);
            if(obj === null){
                result = JOB_OBJ_DISAPPEARED;
            }else if(_.sum(creep.carry) < creep.carryCapacity){
                result = creep.harvest(obj);
                if(result === ERR_NOT_IN_RANGE){
                    result = creep.moveTo(obj, {visualizePathStyle:{fill: 'transparent',stroke: '#fffdfe',lineStyle: 'undefined',strokeWidth: .15,opacity: .5}});
                }
            }else{
                for(const resourceType in creep.carry) {
                    result = creep.drop(resourceType);
                }
            }
            return result;
        }

        // flag jobs:

        /**@return {int}*/
        function JobTagController(creep, roomJob){
            let result = ERR_NO_RESULT_FOUND;
            const flagObj = Game.flags[roomJob.JobId];
            if(flagObj === undefined){
                result = JOB_OBJ_DISAPPEARED;
            }else if(flagObj.room === undefined){ // room is not in Game.rooms
                result = creep.moveTo(flagObj);
            }else{
                result = creep.signController(flagObj.room.controller, flagObj.name);
                if(result === ERR_NOT_IN_RANGE){
                    result = creep.moveTo(flagObj.room.controller, {visualizePathStyle:{fill: 'transparent',stroke: '#ffb900',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                }else if(result === OK ){
                    result = JOB_IS_DONE;
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobScoutPos(creep, roomJob){
            let result = ERR_NO_RESULT_FOUND;
            const flagObj = Game.flags[roomJob.JobId];
            if(flagObj === undefined){
                result = JOB_OBJ_DISAPPEARED;
            }else if(flagObj.room === undefined){ // room is not in Game.rooms
                result = creep.moveTo(flagObj);
            }else{
                if(flagObj.pos.x === creep.pos.x && flagObj.pos.y === creep.pos.y && flagObj.pos.roomName === creep.pos.roomName){
                    result = creep.say(flagObj.name, true);
                }else{
                    result = creep.moveTo(flagObj, {visualizePathStyle:{fill: 'transparent',stroke: '#ffdb00',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobClaimController(creep, roomJob){
            let result = ERR_NO_RESULT_FOUND;
            const flagObj = Game.flags[roomJob.JobId];
            if(flagObj === undefined){
                result = JOB_OBJ_DISAPPEARED;
            }else if(flagObj.room === undefined){ // room is not in Game.rooms
                result = creep.moveTo(flagObj);
            }else{
                result = creep.claimController(flagObj.room.controller);
                if(result === ERR_NOT_IN_RANGE){
                    result = creep.moveTo(flagObj.room.controller, {visualizePathStyle:{fill: 'transparent',stroke: '#04ff00',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                }else if(result === OK ){
                    result = JOB_IS_DONE;
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobReserveController(creep, roomJob){
            let result = ERR_NO_RESULT_FOUND;
            const flagObj = Game.flags[roomJob.JobId];
            if(flagObj === undefined){
                result = JOB_OBJ_DISAPPEARED;
            }else if(flagObj.room === undefined){ // room is not in Game.rooms
                result = creep.moveTo(flagObj);
            }else{
                result = creep.reserveController(flagObj.room.controller);
                if(result === ERR_NOT_IN_RANGE){
                    result = creep.moveTo(flagObj.room.controller, {visualizePathStyle:{fill: 'transparent',stroke: '#d8ff00',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobGuardPos(creep, roomJob){
            let result = ERR_NO_RESULT_FOUND;
            const flagObj = Game.flags[roomJob.JobId];
            if(flagObj === undefined){
                result = JOB_OBJ_DISAPPEARED;
            }else if(flagObj.room === undefined){ // room is not in Game.rooms
                result = creep.moveTo(flagObj);
            }else{
                const hostileCreep = creep.find(FIND_HOSTILE_CREEPS)[0];
                if(hostileCreep){
                    creep.moveTo(hostileCreep, {visualizePathStyle:{fill: 'transparent',stroke: '#ff5600',lineStyle: 'undefined',strokeWidth: .15,opacity: .5}});
                    result = creep.attack(hostileCreep);
                }else if(flagObj.inRangeTo(creep, 1)){
                    result = creep.say(flagObj.name);
                }else{
                    result = creep.moveTo(flagObj, {visualizePathStyle:{fill: 'transparent',stroke: '#ff5600',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                }
            }
            return result;
        }

        // helper functions:

        /**@return {int}*/
        function JobEnergyAction(creep, roomJob, obj, actionFunction){
            let result = ERR_NO_RESULT_FOUND;
            if(obj === null){
                result = JOB_OBJ_DISAPPEARED;
            }else if(creep.carry[RESOURCE_ENERGY] > 0){
                result = actionFunction.creepAction();
                if(result === ERR_NOT_IN_RANGE){
                    result = creep.moveTo(obj, {visualizePathStyle:{fill: 'transparent',stroke: '#00ff00',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                }
            }else{ // find more energy
                const energySupply = FindClosestEnergy(creep, obj);
                if(energySupply && creep.memory.EnergySupplyType === 'DROP'){
                    result = creep.pickup(energySupply);
                }else if(energySupply){
                    result = creep.withdraw(energySupply, RESOURCE_ENERGY);
                }
                if(result === ERR_NOT_IN_RANGE){
                    result = creep.moveTo(energySupply, {visualizePathStyle:{fill: 'transparent',stroke: '#ffe100',lineStyle: 'dashed',strokeWidth: .15,opacity: .1}});
                }else if(result === ERR_FULL){ // creep store is full with anything other than ENERGY - get rid of it asap
                    if(creep.memory.EnergySupplyType === 'CONTAINER' || creep.memory.EnergySupplyType === 'STORAGE'){
                        for(const resourceType in creep.carry) {
                            result = creep.transfer(energySupply, resourceType);
                        }
                    }else{ // DROP
                        for(const resourceType in creep.carry) {
                            result = creep.drop(resourceType);
                        }
                    }
                }else if(result === OK){ // energy withdrawn successfully - now remove creep.memory.EnergySupply
                    creep.memory.EnergySupply = undefined;
                    creep.memory.EnergySupplyType = undefined;
                }
            }
            return result;
        }

        /**@return {object}*/
        function FindClosestEnergy(creep, obj){
            let energySupply = undefined;
            let energySupplyType = undefined;
            if(creep.memory.EnergySupply){
                energySupply = Game.getObjectById(creep.memory.EnergySupply);// closest link then container then droppedRes then storage
                // if the saved energySupply does not have any energy then remove it to make way for a new search
                if(energySupply && (creep.memory.EnergySupplyType === 'LINK' && energySupply.energy === 0)
                    || (creep.memory.EnergySupplyType === 'CONTAINER' && energySupply.store[RESOURCE_ENERGY] === 0)){
                    energySupplyType = undefined;
                    creep.memory.EnergySupply = undefined;
                    creep.memory.EnergySupplyType = undefined;
                }
            }

            if(!energySupply){
                const energySupplies = obj.room.find(FIND_STRUCTURES, {filter: function(s) {
                    return ((s.structureType === STRUCTURE_STORAGE
                        || s.structureType === STRUCTURE_CONTAINER) && s.store[RESOURCE_ENERGY] >= 100
                        || s.structureType === STRUCTURE_LINK && s.energy >= 100);
                }});
                energySupplies.concat(obj.room.find(FIND_DROPPED_RESOURCES, {filter: function(d) {
                        return (d.resourceType === RESOURCE_ENERGY && d.amount >= 50);
                    }}));
                let bestDistance = Number.MAX_SAFE_INTEGER;
                for(let i = 0; i < energySupplies.length; i++){
                    const distance = Math.sqrt(Math.pow(energySupplies[i].pos.x - creep.pos.x, 2) + Math.pow(energySupplies[i].pos.y - creep.pos.y, 2));
                    if(distance < bestDistance){
                        energySupply = energySupplies[i];
                    }
                }
                if(energySupply){
                    if(energySupply.structureType === undefined){energySupplyType = 'DROP';}
                    else if(energySupply.structureType === STRUCTURE_LINK){energySupplyType = 'LINK';}
                    else if(energySupply.structureType === STRUCTURE_CONTAINER){energySupplyType = 'CONTAINER';}
                    else if(energySupply.structureType === STRUCTURE_STORAGE){energySupplyType = 'STORAGE';}
                    creep.memory.EnergySupply = energySupply.id;
                    creep.memory.EnergySupplyType = energySupplyType;
                }
            }
            return energySupply;
        }
    }
};
module.exports = ExecuteJobs;