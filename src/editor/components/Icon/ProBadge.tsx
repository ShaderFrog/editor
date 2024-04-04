/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';

const ProBadge = () => <span className="pro">PRO</span>;

export const displayUser = (
  user: { name: string; isPro: boolean },
  link?: string
) => {
  const name = user.isPro ? (
    <span className="proName">{user.name}</span>
  ) : (
    user.name
  );
  return (
    <span className="nowrap">
      {link ? <Link href={link}>{name}</Link> : name}
      {user.isPro ? (
        <>
          {' '}
          <ProBadge />
        </>
      ) : null}
    </span>
  );
};

export default ProBadge;
