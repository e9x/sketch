// private
declare class AI {
  isAI: true;
  x: number;
  y: number;
  z: number;
  xVel: number;
  yVel: number;
  zVel: number;
  height: number;
  mSize: number;
  scale: number;
  mYOff: number;
  mROff: number;
  name: string;
  sid: number;
  index: number;
}

declare class AIManager {
  ais: AI[];
}

export default AIManager;
