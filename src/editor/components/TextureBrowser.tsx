import styles from '../styles/editor.module.css';
import React, { useEffect, useMemo, useState } from 'react';

import groupBy from 'lodash.groupby';
import { Asset, AssetSubtype } from '@editor/model/Asset';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { useAssetsAndGroups } from '@editor/api';
import { AssetVersionNodeData } from '@core/graph';
import SearchBox from './SearchBox';

export const assetSortOrder: Record<AssetSubtype, number> = {
  Diffuse: 0,
  Normal: 1,
  Displacement: 2,
  AO: 3,
  Roughness: 4,
  ARM: 5,
  Bump: 5,
  Metal: 6,
  Mask: 7,
  Specular: 8,
};
export const assetSort = (assets: Asset[]) =>
  [...assets].sort(
    (a, b) => assetSortOrder[a.subtype] - assetSortOrder[b.subtype]
  );

const TextureBrowser = ({
  onSelect,
  onClose,
}: {
  onSelect: (a: AssetVersionNodeData) => void;
  onClose: () => void;
}) => {
  const { assets, groups } = useAssetsAndGroups();
  const assetsByGroupId = useMemo(() => groupBy(assets, 'groupId'), [assets]);

  const [showGroups, setShowGroups] = useState(true);
  const [search, setSearch] = useState('');

  const [filteredGroups, setFilteredGroups] = useState(Object.values(groups));
  const [filteredAssets, setFilteredAssets] = useState(
    Object.values(assets).filter((a) => a.subtype === 'Diffuse')
  );

  const doSearch = (search: string) => {
    setSearch(search);
    if (showGroups) {
      setFilteredGroups(
        Object.values(groups).filter(
          (g) =>
            g.name.toLowerCase().includes(search.toLowerCase()) ||
            g.description.toLowerCase().includes(search.toLowerCase())
        )
      );
    } else {
      setFilteredAssets(
        Object.values(assets).filter(
          (a) =>
            a.subtype === 'Diffuse' &&
            a.name.toLowerCase().includes(search.toLowerCase())
        )
      );
    }
  };

  const handleChange = (event: React.FormEvent<HTMLInputElement>) => {
    setShowGroups(event.currentTarget.value === 'true');
  };
  useEffect(() => {
    doSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGroups]);

  return (
    <div className={styles.bottomModal}>
      <button
        className={styles.closeModal}
        onClick={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
      <div className={styles.modalContent}>
        <div className="grid col2 shrinkGrow m-bottom-10">
          <div className={styles.textureSearch}>
            <SearchBox
              value={search}
              onChange={doSearch}
              placeholder="Search textures"
            />
          </div>
          <div>
            <div className="grid col2 m-left-10 shrinkGrow gap25">
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="showGroups"
                  value="true"
                  checked={showGroups}
                  onChange={handleChange}
                />
                Browse Asset Groups
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="showGroups"
                  value="false"
                  checked={!showGroups}
                  onChange={handleChange}
                />
                Browse Textures
              </label>
            </div>
          </div>
        </div>
        {showGroups ? (
          filteredGroups.map((group) => (
            <div key={group.id} className={styles.assetGroup}>
              <div title={group.description} className={styles.groupTitle}>
                {group.name}
              </div>
              <div className={styles.groupList}>
                {assetSort(assetsByGroupId[group.id]).map((asset) => (
                  <div
                    key={asset.id}
                    className={styles.assetCard}
                    onClick={() =>
                      onSelect({
                        assetId: asset.id,
                        versionId: asset.versions[0].id,
                      })
                    }
                  >
                    <div className={styles.assetThumbnail}>
                      <img src={asset.versions[0].thumbnail} alt={asset.name} />
                    </div>
                    <div className={styles.assetSubtype}>{asset.subtype}</div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className={styles.assetList}>
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className={styles.assetCard}
                onClick={() =>
                  onSelect({
                    assetId: asset.id,
                    versionId: asset.versions[0].id,
                  })
                }
              >
                <div className={styles.assetThumbnail}>
                  <img src={asset.versions[0].thumbnail} alt={asset.name} />
                </div>
                <div className={styles.assetSubtype}>{asset.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TextureBrowser;
