import { TradeboardLaunch } from "./tradeboard-launch/Composition";

// Every promo registers its composition here. The id is <project>-<promo>.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <TradeboardLaunch />
    </>
  );
};
