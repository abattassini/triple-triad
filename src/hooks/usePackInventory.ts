import { useCallback, useEffect, useState } from 'react';
import { apiService, type PackCard, type PackStack } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * The open-a-pack flow, shared by My Packs and the Welcome page.
 *
 * Opening is a single call — the backend consumes the pack, draws the five cards and files them in the
 * collection, so the player owns the cards the moment the call returns. The reveal dialog that follows is
 * presentation only, which is why nothing here has to be re-fetched when its animation ends.
 */
export const usePackInventory = () => {
  const { refreshUser } = useAuth();

  const [packs, setPacks] = useState<PackStack[]>([]);
  const [cards, setCards] = useState<PackCard[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    setPacks(await apiService.getPackInventory());
  }, []);

  // The inventory is the page's own source of truth; the profile is refreshed alongside it so every coin and
  // pack pill elsewhere stays in step.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const inventory = await apiService.getPackInventory();
        if (!cancelled) {
          setPacks(inventory);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError((loadError as Error).message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();
    refreshUser();

    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const totalPacks = packs.reduce((total, pack) => total + pack.quantity, 0);
  // The shop sells one pack today, so the pages open the pack they are showing.
  const shownPack = packs[0] ?? null;

  const openPack = useCallback(async () => {
    setIsOpening(true);
    setError(null);

    try {
      const opened = await apiService.openPack(shownPack?.code);

      // The cards are already drawn, filed and owned; the dialog only replays them face-down, so this is the
      // whole of the "receive the cards" step.
      setCards(opened.cards);
      setIsRevealing(true);

      setPacks(current =>
        current
          .map(pack =>
            pack.code === opened.packCode ? { ...pack, quantity: opened.packsOwned } : pack
          )
          .filter(pack => pack.quantity > 0)
      );

      await refreshUser();
    } catch (openError) {
      setError((openError as Error).message);

      // A failed open means this page's count is stale (e.g. another tab opened the last pack).
      try {
        await loadInventory();
      } catch {
        // Ignore: the open error above is the message worth showing.
      }
    } finally {
      setIsOpening(false);
    }
  }, [loadInventory, refreshUser, shownPack?.code]);

  const dismissReveal = useCallback(() => setIsRevealing(false), []);
  const clearError = useCallback(() => setError(null), []);

  return {
    packs,
    totalPacks,
    shownPack,
    cards,
    isRevealing,
    isLoading,
    isOpening,
    error,
    openPack,
    dismissReveal,
    clearError,
  };
};
