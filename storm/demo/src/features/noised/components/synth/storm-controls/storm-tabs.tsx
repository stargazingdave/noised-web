import { useState, type ReactNode } from "react";
import { IoRainyOutline } from "react-icons/io5";
import { AmpToggleSwitch } from "noised-ui";
import { useEqualizerColors } from "../../../hooks/use-equalizer-colors";
import { useNoisedController } from "../../../hooks/noised-controller-provider";
import { RainControls } from "../../synth/panels/rain-controls";
import { ThunderControls } from "../../synth/panels/thunder-controls";
import { FaBoltLightning } from "react-icons/fa6";
import { IconType } from "react-icons";
import React from "react";

type ControlTab = "rain" | "thunder";

const tabs: ReadonlyArray<{ id: ControlTab; label: string; icon: IconType }> = [
  { id: "rain", label: "Rain", icon: IoRainyOutline },
  { id: "thunder", label: "Thunder", icon: FaBoltLightning },
];

function TabPanel({
  children,
  id,
}: Readonly<{ children: ReactNode; id: ControlTab }>) {
  return (
    <div
      aria-labelledby={`${id}-tab`}
      className="storm-tab-panel"
      id={`${id}-panel`}
      role="tabpanel"
    >
      {children}
    </div>
  );
}

export function StormTabs() {
  const { actions, params } = useNoisedController();
  const [selectedTab, setSelectedTab] = useState<ControlTab>("rain");
  const equalizerColors = useEqualizerColors();

  return (
    <>
      <div
        aria-label="NoiseD Storm control groups"
        className="storm-tabs"
        role="tablist"
      >
        {tabs.map((tab, index) => (
          <div
            className="storm-tab-item"
            key={tab.id}
            data-selected={selectedTab === tab.id}
          >
            <button
              aria-controls={`${tab.id}-panel`}
              aria-selected={selectedTab === tab.id}
              className="storm-tab"
              id={`${tab.id}-tab`}
              onClick={() => setSelectedTab(tab.id)}
              tabIndex={selectedTab === tab.id ? 0 : -1}
              onKeyDown={(event) => {
                const next =
                  event.key === "Home"
                    ? tabs[0]
                    : event.key === "End"
                      ? tabs[tabs.length - 1]
                      : event.key === "ArrowRight"
                        ? tabs[(index + 1) % tabs.length]
                        : event.key === "ArrowLeft"
                          ? tabs[(index + tabs.length - 1) % tabs.length]
                          : null;
                if (next) {
                  event.preventDefault();
                  setSelectedTab(next.id);
                  document.getElementById(`${next.id}-tab`)?.focus();
                }
              }}
              role="tab"
              type="button"
            >
              {React.createElement(tab.icon, {
                "aria-hidden": true,
                size: 18,
              })}
              <span className="storm-tab-label">{tab.label}</span>
            </button>
            <AmpToggleSwitch
              className="storm-layer-toggle"
              label={`${tab.label} enabled`}
              checked={
                tab.id === "rain"
                  ? params.rainParams.on
                  : params.thunderParams.on
              }
              onChange={
                tab.id === "rain"
                  ? actions.setRainEnabled
                  : actions.setThunderEnabled
              }
            />
          </div>
        ))}
      </div>

      {selectedTab === "rain" && (
        <TabPanel id="rain">
          <RainControls
            actions={actions}
            colors={equalizerColors}
            params={params}
          />
        </TabPanel>
      )}
      {selectedTab === "thunder" && (
        <TabPanel id="thunder">
          <ThunderControls
            actions={actions}
            colors={equalizerColors}
            params={params}
          />
        </TabPanel>
      )}
    </>
  );
}
