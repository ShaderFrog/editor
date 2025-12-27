import styles from '../styles/editor.module.css';
import React, { useEffect, useMemo, useState } from 'react';

import groupBy from 'lodash.groupby';
import { Asset, AssetSubtype } from '@editor/model/Asset';
import { useAssetsAndGroups } from '@editor/api';
import { TextureNodeValueData } from '@core/graph';
import SearchBox from './SearchBox';

export const assetSortOrder: Record<AssetSubtype, number> = {
  Diffuse: 0,
  Normal: 1,
  'Normal DX': 3,
  Displacement: 4,
  AO: 5,
  Roughness: 6,
  ARM: 7,
  Bump: 8,
  Metal: 9,
  Mask: 10,
  Specular: 11,
};
export const assetSort = (assets: Asset[]) =>
  [...assets].sort(
    (a, b) => assetSortOrder[a.subtype] - assetSortOrder[b.subtype]
  );

const hasMultiDiffuse = (assets: Asset[]) =>
  assets.filter((a) => a.subtype === 'Diffuse').length > 1;

const TextureBrowser = ({
  onSelect,
}: {
  onSelect: (a: TextureNodeValueData) => void;
}) => {
  const assetsAndGroupsData = useAssetsAndGroups();
  const groups = assetsAndGroupsData?.groups || {};
  // Filter to only show Image type assets, excluding CubeMap and Envmap
  const assets = useMemo(() => {
    const allAssets = assetsAndGroupsData?.assets || {};
    return Object.values(allAssets).filter((a) => a && a.type === 'Image');
  }, [assetsAndGroupsData]);
  const assetsByGroupId = useMemo(() => groupBy(assets, 'groupId'), [assets]);

  const [showGroups, setShowGroups] = useState(true);
  const [search, setSearch] = useState('');

  const [filteredGroups, setFilteredGroups] = useState(Object.values(groups));
  const [filteredAssets, setFilteredAssets] = useState(Object.values(assets));

  const multiGroups = useMemo(() => {
    return new Set(
      Object.entries(assetsByGroupId).reduce<number[]>((acc, [id, group]) => {
        if (hasMultiDiffuse(group)) {
          acc.push(parseFloat(id));
        }
        return acc;
      }, [])
    );
  }, [assetsByGroupId]);

  const doSearch = (rawSearch: string) => {
    const seach = search.toLowerCase().normalize();

    setSearch(rawSearch);
    if (showGroups) {
      setFilteredGroups(
        Object.values(groups).filter(
          (g) =>
            g.name.toLowerCase().includes(seach) ||
            g.description.toLowerCase().includes(seach) ||
            assetsByGroupId[g.id].some((a) =>
              a.name.toLowerCase().normalize().includes(seach)
            )
        )
      );
    } else {
      setFilteredAssets(
        Object.values(assets).filter((a) =>
          a.name.toLowerCase().normalize().includes(seach)
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
    <>
      <div className="grid col2 growShrink m-bottom-10">
        <div>
          <div className="grid col2 shrinkGrow gap25">
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
        <div className={styles.textureSearch}>
          <SearchBox
            value={search}
            onChange={doSearch}
            placeholder="Search textures"
          />
        </div>
      </div>
      {showGroups ? (
        filteredGroups.map((group) => (
          <div key={group.id} className={styles.assetGroup}>
            <div title={group.description} className={styles.groupTitle}>
              {group.name}
            </div>
            <div
              className={
                multiGroups.has(group.id)
                  ? styles.diffuseList
                  : styles.groupList
              }
            >
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
                    {asset.versions.length > 1 ? (
                      <div className={styles.hiRes}>High res</div>
                    ) : null}
                  </div>
                  {multiGroups.has(group.id) ? (
                    <div className={styles.assetName} title={asset.name}>
                      {asset.name}
                    </div>
                  ) : (
                    <div className={styles.assetSubtype} title={asset.subtype}>
                      {asset.subtype}
                    </div>
                  )}
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
    </>
  );
};

export default TextureBrowser;
