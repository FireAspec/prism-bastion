import {it,expect} from 'vitest';
import {pointOnLane,laneLength,distanceToSegment,pointInPolygon} from '../../src/contracts/geometry';
it('tracks progress as arc length across bends and clamps endpoints',()=>{
 const lane=[{x:0,y:0},{x:30,y:0},{x:30,y:40}];
 expect(laneLength(lane)).toBe(70);expect(pointOnLane(lane,50)).toEqual({x:30,y:20});
 expect(pointOnLane(lane,-5)).toEqual({x:0,y:0});expect(pointOnLane(lane,100)).toEqual({x:30,y:40});
 expect(distanceToSegment({x:15,y:4},lane[0],lane[1])).toBe(4);
 expect(pointInPolygon({x:2,y:2},[{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:0,y:4}])).toBe(true);
});
