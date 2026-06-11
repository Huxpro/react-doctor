import { useState } from "@lynx-js/react";

export const App = (): JSX.Element => {
  const [count, setCount] = useState(0);
  return (
    <view>
      <text>{`Count: ${count}`}</text>
      <text bindtap={() => setCount((previous) => previous + 1)}>Increment</text>
    </view>
  );
};
