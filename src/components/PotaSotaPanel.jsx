/**
 * PotaSotaPanel Component
 * Tabbed panel that switches between POTA, WWFF, SOTA and WWBOTA views.
 * Used in Classic and Modern layouts. In Dockable layout, each is a separate panel.
 */
import React, { useState } from 'react';
import { POTAPanel } from './POTAPanel.jsx';
import { WWFFPanel } from './WWFFPanel.jsx';
import { SOTAPanel } from './SOTAPanel.jsx';
import { WWBOTAPanel } from './WWBOTAPanel.jsx';

const TABS = ['pota', 'wwff', 'sota', 'wwbota'];

export const PotaSotaPanel = ({
  potaData,
  potaLoading,
  potaLastUpdated,
  potaLastChecked,
  showPOTA,
  onTogglePOTA,
  showPOTALabels,
  togglePOTALabels,
  onPOTASpotClick,
  onPOTAHoverSpot,
  potaFilters,
  setShowPotaFilters,
  filteredPotaSpots,

  wwffData,
  wwffLoading,
  wwffLastUpdated,
  wwffLastChecked,
  showWWFF,
  onToggleWWFF,
  showWWFFLabels,
  toggleWWFFLabels,
  onWWFFSpotClick,
  onWWFFHoverSpot,
  wwffFilters,
  setShowWwffFilters,
  filteredWwffSpots,

  sotaData,
  sotaLoading,
  sotaLastUpdated,
  sotaLastChecked,
  showSOTA,
  onToggleSOTA,
  showSOTALabels,
  toggleSOTALabels,
  onSOTASpotClick,
  onSOTAHoverSpot,
  sotaFilters,
  setShowSotaFilters,
  filteredSotaSpots,

  wwbotaData,
  wwbotaLoading,
  wwbotaLastUpdated,
  wwbotaConnected,
  showWWBOTA,
  onToggleWWBOTA,
  showWWBOTALabels,
  toggleWWBOTALabels,
  onWWBOTASpotClick,
  onWWBOTAHoverSpot,
  wwbotaFilters,
  setShowWwbotaFilters,
  filteredWwbotaSpots,
}) => {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('openhamclock_potaSotaTab');
      return TABS.includes(saved) ? saved : 'pota';
    } catch {
      return 'pota';
    }
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('openhamclock_potaSotaTab', tab);
    } catch {}
  };

  const tabColors = { pota: '#44cc44', wwff: '#a3f3a3', sota: '#ff9632', wwbota: '#8b7fff' };
  const tabShapes = { pota: '▲', wwff: '▼', sota: '◆', wwbota: '■' };

  const tabStyle = (tab) => ({
    flex: 1,
    padding: '3px 0',
    background: activeTab === tab ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
    border: 'none',
    borderBottom: activeTab === tab ? `2px solid ${tabColors[tab]}` : '2px solid transparent',
    color: activeTab === tab ? tabColors[tab] : '#666',
    fontSize: tab === 'wwbota' ? '9px' : '10px',
    fontFamily: 'var(--font-mono)',
    fontWeight: activeTab === tab ? '700' : '400',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

  const tabBadge = (tab) => (
    <span
      style={{
        display: 'inline-block',
        background: tabColors[tab],
        color: '#000',
        padding: '0px 3px',
        borderRadius: '2px',
        fontWeight: '700',
        fontSize: '9px',
        lineHeight: 1.3,
        verticalAlign: 'middle',
        marginRight: '2px',
      }}
    >
      {tabShapes[tab]}
    </span>
  );

  const potaStaleMin = potaLastUpdated ? Math.floor((Date.now() - potaLastUpdated) / 60000) : null;
  const sotaStaleMin = sotaLastUpdated ? Math.floor((Date.now() - sotaLastUpdated) / 60000) : null;
  const wwffStaleMin = wwffLastUpdated ? Math.floor((Date.now() - wwffLastUpdated) / 60000) : null;

  const staleWarning = (minutes) => {
    if (minutes === null || minutes < 5) return '';
    return ` ⚠${minutes}m`;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        <button style={tabStyle('pota')} onClick={() => handleTabChange('pota')}>
          {tabBadge('pota')} POTA {potaData?.length > 0 ? `(${potaData.length})` : ''}
          {potaStaleMin >= 5 && (
            <span style={{ color: potaStaleMin >= 10 ? '#ff4444' : '#ffaa00' }}>{staleWarning(potaStaleMin)}</span>
          )}
        </button>
        <button style={tabStyle('wwff')} onClick={() => handleTabChange('wwff')}>
          {tabBadge('wwff')} WWFF {wwffData?.length > 0 ? `(${wwffData.length})` : ''}
          {wwffStaleMin >= 5 && (
            <span style={{ color: wwffStaleMin >= 10 ? '#ff4444' : '#ffaa00' }}>{staleWarning(wwffStaleMin)}</span>
          )}
        </button>
        <button style={tabStyle('sota')} onClick={() => handleTabChange('sota')}>
          {tabBadge('sota')} SOTA {sotaData?.length > 0 ? `(${sotaData.length})` : ''}
          {sotaStaleMin >= 5 && (
            <span style={{ color: sotaStaleMin >= 10 ? '#ff4444' : '#ffaa00' }}>{staleWarning(sotaStaleMin)}</span>
          )}
        </button>
        <button style={tabStyle('wwbota')} onClick={() => handleTabChange('wwbota')}>
          {tabBadge('wwbota')} WWBOTA {wwbotaData?.length > 0 ? `(${wwbotaData.length})` : ''}
          <span style={{ color: wwbotaConnected ? '#44cc44' : '#ff4444', marginLeft: '4px' }}>
            {wwbotaConnected ? '' : '✗'}
          </span>
        </button>
      </div>

      {/* Active panel */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {activeTab === 'pota' ? (
          <POTAPanel
            data={potaData}
            loading={potaLoading}
            lastUpdated={potaLastUpdated}
            lastChecked={potaLastChecked}
            showOnMap={showPOTA}
            onToggleMap={onTogglePOTA}
            onSpotClick={onPOTASpotClick}
            onHoverSpot={onPOTAHoverSpot}
            showLabelsOnMap={showPOTALabels}
            onToggleLabelsOnMap={togglePOTALabels}
            filters={potaFilters}
            onOpenFilters={setShowPotaFilters}
            filteredData={filteredPotaSpots}
          />
        ) : activeTab === 'sota' ? (
          <SOTAPanel
            data={sotaData}
            loading={sotaLoading}
            lastUpdated={sotaLastUpdated}
            lastChecked={sotaLastChecked}
            showOnMap={showSOTA}
            onToggleMap={onToggleSOTA}
            onSpotClick={onSOTASpotClick}
            onHoverSpot={onSOTAHoverSpot}
            showLabelsOnMap={showSOTALabels}
            onToggleLabelsOnMap={toggleSOTALabels}
            filters={sotaFilters}
            onOpenFilters={setShowSotaFilters}
            filteredData={filteredSotaSpots}
          />
        ) : activeTab === 'wwbota' ? (
          <WWBOTAPanel
            data={wwbotaData}
            loading={wwbotaLoading}
            lastUpdated={wwbotaLastUpdated}
            connected={wwbotaConnected}
            showOnMap={showWWBOTA}
            onToggleMap={onToggleWWBOTA}
            onSpotClick={onWWBOTASpotClick}
            onHoverSpot={onWWBOTAHoverSpot}
            showLabelsOnMap={showWWBOTALabels}
            onToggleLabelsOnMap={toggleWWBOTALabels}
            filters={wwbotaFilters}
            onOpenFilters={setShowWwbotaFilters}
            filteredData={filteredWwbotaSpots}
          />
        ) : (
          <WWFFPanel
            data={wwffData}
            loading={wwffLoading}
            lastUpdated={wwffLastUpdated}
            lastChecked={wwffLastChecked}
            showOnMap={showWWFF}
            onToggleMap={onToggleWWFF}
            onSpotClick={onWWFFSpotClick}
            onHoverSpot={onWWFFHoverSpot}
            showLabelsOnMap={showWWFFLabels}
            onToggleLabelsOnMap={toggleWWFFLabels}
            filters={wwffFilters}
            onOpenFilters={setShowWwffFilters}
            filteredData={filteredWwffSpots}
          />
        )}
      </div>
    </div>
  );
};

export default PotaSotaPanel;
