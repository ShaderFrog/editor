import styles from '../styles/editor.module.css';
import React, { useMemo, useState } from 'react';

import { useQueryAssets } from '@/pages/api/asset/useQueryAssets';
import groupBy from 'lodash.groupby';
import { Asset, AssetSubtype } from '@/model/asset_model';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faTimes } from '@fortawesome/free-solid-svg-icons';

const assetSortOrder: Record<AssetSubtype, number> = {
  Diffuse: 0,
  Normal: 1,
  Displacement: 2,
  AO: 3,
  Roughness: 4,
  ARM: 5,
};
const assetSort = (assets: Asset[]) =>
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
  const { assets, groups } = useQueryAssets();
  const assetsByGroupId = useMemo(() => groupBy(assets, 'groupId'), [assets]);

  const [showGroups, setShowGroups] = useState(true);
  const [search, setSearch] = useState('');
  const [filteredGroups, setFilteredGroups] = useState(Object.values(groups));

  const doSearch = (search: string) => {
    setFilteredGroups(
      Object.values(groups).filter(
        (g) =>
          g.name.toLowerCase().includes(search.toLowerCase()) ||
          g.description.toLowerCase().includes(search.toLowerCase())
      )
    );
  };

  const onChange = (event: React.FormEvent<HTMLInputElement>) => {
    const search = event.currentTarget.value || '';
    setSearch(search);
    doSearch(search);
  };

  const handleChange = (event: React.FormEvent<HTMLInputElement>) => {
    setShowGroups(event.currentTarget.value === 'true');
  };

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
            {Object.values(assets).map((asset) => (
              <div
                key={`${asset.name}${asset.subtype}`}
                className={styles.assetCard}
                onClick={() => onSelect(asset)}
              >
                <div className={styles.assetThumbnail}>
                  <img src={asset.thumbnail} alt={asset.name} />
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
                      <img src={asset.thumbnail} alt={asset.name} />
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
