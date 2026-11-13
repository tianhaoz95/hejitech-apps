import { AppPreviews } from "./app-preview/Composition";
import { FitloopDemo } from "./fitloop-demo/Composition";
import { FitloopLaunch } from "./fitloop-launch/Composition";
import { G2digestDemo } from "./g2digest-demo/Composition";
import { G2digestLaunch } from "./g2digest-launch/Composition";
import { HeadwayDemo } from "./headway-demo/Composition";
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
      <HeadwayDemo />
      <WeehoursLaunch />
      <TinytouchLaunch />
      <ToddlercamLaunch />
      <FitloopLaunch />
      <FitloopDemo />
      <G2digestLaunch />
      <G2digestDemo />
      <WaypackLaunch />
      <AppPreviews />
    </>
  );
};
