import styles from '../styles/editor.module.css';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCloudUpload,
  faUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons';

import groupBy from 'lodash.groupby';
import { Asset, AssetGroup, AssetSubtype } from '@editor/model/Asset';
import { useAssetsAndGroups } from '@editor/api';
import { TextureNodeValueData } from '@core/graph';
import SearchBox from './SearchBox';
import ProBadge from './ProBadge/ProBadge';
import { pathTo } from '@/util/site';
import { CurrentUser } from '@editor/model/CurrentUser';

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
  currentUser,
}: {
  onSelect: (a: TextureNodeValueData) => void;
  currentUser: CurrentUser | null;
}) => {
  const assetsAndGroupsData = useAssetsAndGroups();

  // Filter out environments from the texture browser
  const groups = Object.entries(assetsAndGroupsData?.groups || {}).reduce<
    Record<string, AssetGroup>
  >(
    (acc, [id, group]) =>
      group.type !== 'Environment' ? { ...acc, [id]: group } : acc,
    {}
  );

  // Filter to only show Image type assets, excluding CubeMap and Envmap
  const assets = useMemo(() => {
    const allAssets = assetsAndGroupsData?.assets || {};
    return Object.values(allAssets).filter((a) => a && a.type === 'Image');
  }, [assetsAndGroupsData]);
  const assetsByGroupId = useMemo(() => groupBy(assets, 'groupId'), [assets]);

  const [activeTab, setActiveTab] = useState<'groups' | 'textures' | 'upload'>(
    'groups'
  );
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
    if (activeTab === 'groups') {
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
    } else if (activeTab === 'textures') {
      setFilteredAssets(
        Object.values(assets).filter((a) =>
          a.name.toLowerCase().normalize().includes(seach)
        )
      );
    }
  };

  const handleChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;
    if (value === 'groups' || value === 'textures' || value === 'upload') {
      setActiveTab(value);
    }
  };
  useEffect(() => {
    doSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <>
      <div className="grid col2 growShrink m-bottom-10">
        <div>
          <div className="grid col4 shrinkShrinkShrinkGrow gap25">
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="activeTab"
                value="groups"
                checked={activeTab === 'groups'}
                onChange={handleChange}
              />
              Browse Asset Groups
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="activeTab"
                value="textures"
                checked={activeTab === 'textures'}
                onChange={handleChange}
              />
              Browse Textures
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="activeTab"
                value="upload"
                checked={activeTab === 'upload'}
                onChange={handleChange}
              />
              <FontAwesomeIcon
                icon={faCloudUpload}
                style={{ color: '#c5f995' }}
              />{' '}
              Upload Textures
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
      {activeTab === 'groups' ? (
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
      ) : activeTab === 'textures' ? (
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
      ) : activeTab === 'upload' ? (
        <div>
          {currentUser?.isPro ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '10px' }}>
                Asset Manager <ProBadge />
              </h3>
              <Link
                passHref
                href={pathTo('/members/assets')}
                className="button"
                target="_blank"
              >
                Open Asset Manager{' '}
                <FontAwesomeIcon icon={faUpRightFromSquare} />
              </Link>
              <p className="secondary">
                Manage your textures and assets in the asset manager.
              </p>
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '10px' }}>
                Shaderfrog <ProBadge />
              </h3>
              <p style={{ marginBottom: '20px' }}>
                Upgrade to Pro to manage your assets and upload custom textures.
              </p>
              <Link
                passHref
                href={pathTo('/products')}
                className="button"
                target="_blank"
              >
                Upgrade to Pro! <FontAwesomeIcon icon={faUpRightFromSquare} />
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
};

export default TextureBrowser;
