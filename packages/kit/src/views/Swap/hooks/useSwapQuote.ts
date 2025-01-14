import { useCallback, useEffect, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { EPageType, Toast, usePageType } from '@onekeyhq/components';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import {
  ESwapApproveTransactionStatus,
  ESwapDirectionType,
  type ISwapApproveTransaction,
} from '@onekeyhq/shared/types/swap/types';

import { useDebounce } from '../../../hooks/useDebounce';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import {
  useSwapActions,
  useSwapApproveAllowanceSelectOpenAtom,
  useSwapFromTokenAmountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippageDialogOpeningAtom,
} from '../../../states/jotai/contexts/swap';
import { truncateDecimalPlaces } from '../utils/utils';

import { useSwapAddressInfo } from './useSwapAccount';

export function useSwapQuote() {
  const intl = useIntl();
  const { quoteAction, cleanQuoteInterval, recoverQuoteInterval } =
    useSwapActions().current;
  const swapAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapSlippageDialogOpening] = useSwapSlippageDialogOpeningAtom();
  const [swapApproveAllowanceSelectOpen] =
    useSwapApproveAllowanceSelectOpenAtom();
  const [fromTokenAmount, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [{ swapApprovingTransaction }, setInAppNotificationAtom] =
    useInAppNotificationAtom();
  const fromAmountRef = useRef(fromTokenAmount);
  if (fromAmountRef.current !== fromTokenAmount) {
    fromAmountRef.current = fromTokenAmount;
  }
  const activeAccountRef = useRef<
    ReturnType<typeof useSwapAddressInfo> | undefined
  >();
  if (activeAccountRef.current !== swapAddressInfo) {
    activeAccountRef.current = swapAddressInfo;
  }
  const swapApprovingTxRef = useRef<ISwapApproveTransaction | undefined>();
  if (swapApprovingTxRef.current !== swapApprovingTransaction) {
    swapApprovingTxRef.current = swapApprovingTransaction;
  }
  const fromAmountDebounce = useDebounce(fromTokenAmount, 500);
  const alignmentDecimal = useCallback(() => {
    const checkedDecimal = truncateDecimalPlaces(
      fromAmountDebounce,
      fromToken?.decimals,
    );
    if (checkedDecimal && checkedDecimal !== fromAmountDebounce) {
      setFromTokenAmount(checkedDecimal);
    }
  }, [fromToken?.decimals, fromAmountDebounce, setFromTokenAmount]);

  useEffect(() => {
    if (swapSlippageDialogOpening.status || swapApproveAllowanceSelectOpen) {
      cleanQuoteInterval();
    } else if (
      !swapSlippageDialogOpening.status &&
      swapSlippageDialogOpening.flag === 'save'
    ) {
      void quoteAction(
        activeAccountRef.current?.address,
        activeAccountRef.current?.accountInfo?.account?.id,
      );
    } else {
      void recoverQuoteInterval(
        activeAccountRef.current?.address,
        activeAccountRef.current?.accountInfo?.account?.id,
      );
    }
  }, [
    quoteAction,
    cleanQuoteInterval,
    recoverQuoteInterval,
    swapApproveAllowanceSelectOpen,
    swapSlippageDialogOpening,
  ]);

  useEffect(() => {
    if (
      swapApprovingTransaction &&
      swapApprovingTransaction.txId &&
      swapApprovingTransaction.status ===
        ESwapApproveTransactionStatus.SUCCESS &&
      !swapApprovingTransaction.resetApproveValue &&
      fromAmountRef?.current
    ) {
      void quoteAction(
        activeAccountRef.current?.address,
        activeAccountRef.current?.accountInfo?.account?.id,
        swapApprovingTransaction.blockNumber,
      );
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.swap_page_toast_approve_successful,
        }),
      });
    }
  }, [
    intl,
    cleanQuoteInterval,
    quoteAction,
    swapApprovingTransaction,
    setInAppNotificationAtom,
  ]);

  useEffect(() => {
    if (fromToken?.networkId !== activeAccountRef.current?.networkId) {
      return;
    }
    alignmentDecimal();
    void quoteAction(
      activeAccountRef.current?.address,
      activeAccountRef.current?.accountInfo?.account?.id,
    );
    return () => {
      cleanQuoteInterval();
    };
  }, [
    cleanQuoteInterval,
    quoteAction,
    swapAddressInfo.address,
    swapAddressInfo.networkId,
    fromToken,
    toToken?.networkId,
    toToken?.contractAddress,
    alignmentDecimal,
  ]);

  const pageType = usePageType();
  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (pageType !== EPageType.modal) {
        if (isFocus && !isHiddenModel && !swapApprovingTxRef.current?.txId) {
          void recoverQuoteInterval(
            activeAccountRef.current?.address,
            activeAccountRef.current?.accountInfo?.account?.id,
          );
        } else {
          cleanQuoteInterval();
        }
      }
    },
  );

  const isFocused = useIsFocused();
  useEffect(() => {
    if (pageType === EPageType.modal) {
      if (isFocused && !swapApprovingTxRef.current?.txId) {
        void recoverQuoteInterval(
          activeAccountRef.current?.address,
          activeAccountRef.current?.accountInfo?.account?.id,
        );
      } else {
        cleanQuoteInterval();
      }
    }
  }, [cleanQuoteInterval, isFocused, pageType, recoverQuoteInterval]);
}
