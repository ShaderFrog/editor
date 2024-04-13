import styles from '../styles/editor.module.css';
import React, { useEffect, useMemo, useState } from 'react';

import groupBy from 'lodash.groupby';
import { Asset, AssetSubtype } from '@editor/model/Asset';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useAssetsAndGroups } from '@editor/api';

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
  onSelect: (a: Asset) => void;
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

  const onChange = (event: React.FormEvent<HTMLInputElement>) => {
    const search = event.currentTarget.value || '';
    setSearch(search);
    doSearch(search);
  };

  const handleChange = (event: React.FormEvent<HTMLInputElement>) => {
    setShowGroups(event.currentTarget.value === 'true');
  };
  useEffect(() => {
    setSearch('');
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
        <div className="grid col2 shrinkGrow">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              doSearch(search);
            }}
            className="searchwrap m-bottom-10"
            style={{ width: '200px' }}
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input
              name="search"
              className="textinput searchinput"
              placeholder="Search textures"
              value={search}
              onChange={onChange}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  doSearch(search);
                }
                if (event.key === 'Escape') {
                  setSearch('');
                  doSearch('');
                }
              }}
            />
          </form>
          <div>
            <div className="grid col2 m-left-10 shrinkGrow gap25">
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="showGroups"
                  value="false"
                  checked={!showGroups}
                  onChange={handleChange}
                />
                Browse Asset Groups
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="showGroups"
                  value="true"
                  checked={showGroups}
                  onChange={handleChange}
                />
                Browse Textures
              </label>
            </div>
          </div>
        </div>
        {showGroups ? (
          <div className={styles.assetList}>
            {filteredAssets.map((asset) => (
              <div
                key={`${asset.name}${asset.subtype}`}
                className={styles.assetCard}
                onClick={() => onSelect(asset)}
              >
                <div className={styles.assetThumbnail}>
                  {/* TODO: NEED TO PICK RIGHT ASSET VERSION HERE */}
                  <img src={asset.versions[0].thumbnail} alt={asset.name} />
                </div>
                <div className={styles.assetSubtype}>{asset.name}</div>
              </div>
            ))}
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.id} className={styles.assetGroup}>
              <div title={group.description} className={styles.groupTitle}>
                {group.name}
              </div>
              <div className={styles.groupList}>
                {assetSort(assetsByGroupId[group.id]).map((asset) => (
                  <div
                    key={`${asset.name}${asset.subtype}`}
                    className={styles.assetCard}
                    onClick={() => onSelect(asset)}
                  >
                    <div className={styles.assetThumbnail}>
                      {/* TODO: NEED TO PICK RIGHT ASSET VERSION HERE */}
                      <img src={asset.versions[0].thumbnail} alt={asset.name} />
                    </div>
                    <div className={styles.assetSubtype}>{asset.subtype}</div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TextureBrowser;
