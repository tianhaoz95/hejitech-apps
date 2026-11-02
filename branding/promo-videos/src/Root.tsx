import { FitloopLaunch } from "./fitloop-launch/Composition";
import { G2digestLaunch } from "./g2digest-launch/Composition";
import { HeadwayLaunch } from "./headway-launch/Composition";
import { TinytouchLaunch } from "./tinytouch-launch/Composition";
import { ToddlercamLaunch } from "./toddlercam-launch/Composition";
import { TradeboardLaunch } from "./tradeboard-launch/Composition";
import { WaypackLaunch } from "./waypack-launch/Composition";
import { WeehoursLaunch } from "./weehours-launch/Composition";

// Every promo registers its composition here. The id is <project>-<promo>.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <TradeboardLaunch />
      <HeadwayLaunch />
      <WeehoursLaunch />
      <TinytouchLaunch />
      <ToddlercamLaunch />
      <FitloopLaunch />
      <G2digestLaunch />
      <WaypackLaunch />
    </>
  );
};
