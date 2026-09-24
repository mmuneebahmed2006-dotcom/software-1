import {
  memo,
  useMemo,
  useState,
  useEffect,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  Globe2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";

import logoMark from "@/assets/logo-mark.png";

import {
  DOC_LABELS,
  PAPER_SIZES,
  money,
  uid,
  type DocState,
  type DocType,
  type LineItem,
  type PaperSizeKey,
} from "@/lib/document";

import { Button } from "@/components/ui/button";

import {
  AreaField,
  NumberField,
  TextField,
} from "@/components/field";

interface Props {
  docType: DocType;
  state: DocState;
  setState: Dispatch<SetStateAction<DocState>>;
  paperStyle: CSSProperties;
  paperSize: PaperSizeKey;
}

/* =========================================================
   PAGE LINE LIMITS

   PAGE 1  = 14 lines
   PAGE 2+ = 18 lines
   ========================================================= */

const FIRST_PAGE_CAPACITY = 14;
const OTHER_PAGE_CAPACITY = 18;

/* =========================================================
   DOCUMENT PAPER
   ========================================================= */

export function DocumentPaper({
  docType,
  state,
  setState,
  paperStyle,
  paperSize,
}: Props) {
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);

  /* =======================================================
     CREATE PAGES

     Page 1:
       1 - 14

     Page 2:
       15 - 32

     Page 3:
       33 - 50

     Page 4:
       51 - 68

     etc.
     ======================================================= */

  const pages = useMemo(() => {
    const chunks: LineItem[][] = [];

    /* -----------------------------
       PAGE 1 = 14 ITEMS
       ----------------------------- */

    chunks.push(
      state.items.slice(
        0,
        FIRST_PAGE_CAPACITY
      )
    );

    /* -----------------------------
       PAGE 2+ = 18 ITEMS EACH
       ----------------------------- */

    let index = FIRST_PAGE_CAPACITY;

    while (index < state.items.length) {
      chunks.push(
        state.items.slice(
          index,
          index + OTHER_PAGE_CAPACITY
        )
      );

      index += OTHER_PAGE_CAPACITY;
    }

    /* -----------------------------
       MINIMUM PAGES
       ----------------------------- */

    while (
      chunks.length < state.minimumPages
    ) {
      chunks.push([]);
    }

    return chunks;
  }, [
    state.items,
    state.minimumPages,
  ]);

  /* =======================================================
     GET ITEM START NUMBER FOR EACH PAGE
     ======================================================= */

  const getPageStartIndex = (
    pageIndex: number
  ) => {
    if (pageIndex === 0) {
      return 0;
    }

    return (
      FIRST_PAGE_CAPACITY +
      (pageIndex - 1) *
        OTHER_PAGE_CAPACITY
    );
  };

  /* =======================================================
     PAGE OBSERVER
     ======================================================= */

  useEffect(() => {
    const observer =
      new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (
              entry.isIntersecting
            ) {
              const pageNum = Number(
                entry.target.getAttribute(
                  "data-page-num"
                )
              );

              if (pageNum) {
                setCurrentPage(pageNum);
              }
            }
          });
        },
        {
          threshold: 0.4,
        }
      );

    pages.forEach((_, index) => {
      const pageElement =
        document.getElementById(
          `paper-page-${index + 1}`
        );

      if (pageElement) {
        observer.observe(
          pageElement
        );
      }
    });

    return () =>
      observer.disconnect();
  }, [pages]);

  /* =======================================================
     UPDATE ITEM
     ======================================================= */

  const updateItem = (
    id: string,
    patch: Partial<LineItem>
  ) => {
    setState((current) => ({
      ...current,

      items: current.items.map(
        (item) =>
          item.id === id
            ? {
                ...item,
                ...patch,
              }
            : item
      ),
    }));
  };

  /* =======================================================
     REMOVE ITEM
     ======================================================= */

  const removeItem = (
    id: string
  ) => {
    setState((current) => ({
      ...current,

      items:
        current.items.length > 1
          ? current.items.filter(
              (item) =>
                item.id !== id
            )
          : current.items,
    }));
  };

  /* =======================================================
     ADD ITEM

     PAGE 1:
       maximum 14

     PAGE 2+:
       maximum 18

     When a page is full, the next item
     automatically goes to the next page.
     ======================================================= */

  const addItemAtPage = (
    pageIndex: number
  ) => {
    setState((current) => {
      const newItem: LineItem = {
        id: uid(),
        description: "",
        unit: "pcs",
        qty: 1,
        rate: 0,
      };

      /*
       * Start position of selected page
       */

      const pageStart =
        getPageStartIndex(
          pageIndex
        );

      /*
       * Number of items currently
       * inside selected page.
       */

      const pageCapacity =
        pageIndex === 0
          ? FIRST_PAGE_CAPACITY
          : OTHER_PAGE_CAPACITY;

      const currentPageItems =
        current.items.slice(
          pageStart,
          pageStart + pageCapacity
        );

      /*
       * If current page is full,
       * add the new item after the
       * current page.
       *
       * That automatically creates
       * the next page.
       */

      let insertIndex =
        pageStart +
        currentPageItems.length;

      /*
       * Keep index safe.
       */

      insertIndex = Math.min(
        insertIndex,
        current.items.length
      );

      const updatedItems = [
        ...current.items,
      ];

      updatedItems.splice(
        insertIndex,
        0,
        newItem
      );

      return {
        ...current,
        items: updatedItems,
      };
    });
  };

  /* =======================================================
     ZOOM
     ======================================================= */

  const handleZoom = (
    newZoom: number
  ) => {
    const clamped = Math.min(
      Math.max(newZoom, 40),
      160
    );

    setZoom(clamped);
  };

  /* =======================================================
     JUMP TO PAGE
     ======================================================= */

  const jumpToPage = (
    pageNum: number
  ) => {
    setCurrentPage(pageNum);

    const pageElement =
      document.getElementById(
        `paper-page-${pageNum}`
      );

    if (pageElement) {
      pageElement.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  /* =======================================================
     RETURN
     ======================================================= */

  return (
    <div
      className="document-paper-wrapper"
      style={{
        position: "relative",
        width: "100%",
      }}
    >
      {/* =================================================
          FLOATING TOOLBAR
          ================================================= */}

      <div
        className="no-print"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          backgroundColor:
            "#0f172a",
          color: "#ffffff",
          padding:
            "8px 16px",
          borderRadius: "40px",
          boxShadow:
            "0 8px 24px rgba(0,0,0,0.4)",
          border:
            "1px solid #334155",
        }}
      >
        <select
          value={currentPage}
          onChange={(event) =>
            jumpToPage(
              Number(
                event.target.value
              )
            )
          }
          style={{
            background:
              "#1e293b",
            color: "#ffffff",
            border:
              "1px solid #475569",
            borderRadius: "6px",
            padding:
              "4px 10px",
            fontSize: "13px",
            outline: "none",
            cursor: "pointer",
          }}
        >
          {pages.map(
            (_, index) => (
              <option
                key={index + 1}
                value={index + 1}
              >
                Page {index + 1} of{" "}
                {pages.length}
              </option>
            )
          )}
        </select>

        <div
          style={{
            width: "1px",
            height: "18px",
            backgroundColor:
              "#475569",
          }}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() =>
            handleZoom(
              zoom - 10
            )
          }
          style={{
            color: "#fff",
            height: "30px",
            width: "30px",
          }}
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </Button>

        <span
          style={{
            fontSize: "13px",
            fontWeight: "bold",
            minWidth: "45px",
            textAlign: "center",
          }}
        >
          {zoom}%
        </span>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() =>
            handleZoom(
              zoom + 10
            )
          }
          style={{
            color: "#fff",
            height: "30px",
            width: "30px",
          }}
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() =>
            handleZoom(100)
          }
          style={{
            color: "#fff",
            height: "30px",
            width: "30px",
          }}
          title="Reset Zoom"
        >
          <RotateCcw size={14} />
        </Button>
      </div>

      {/* =================================================
          ALL PAGES
          ================================================= */}

      <div
        id="document-pages"
        className="document-pages"
        style={{
          transform:
            `scale(${zoom / 100})`,
          transformOrigin:
            "top center",
          transition:
            "transform 0.15s ease-out",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "32px",
          paddingBottom:
            "100px",
        }}
      >
        {pages.map(
          (
            items,
            pageIndex
          ) => (
            <DocumentPage
              key={`paper-page-key-${pageIndex}`}
              docType={docType}
              state={state}
              setState={setState}
              items={items}
              itemOffset={getPageStartIndex(
                pageIndex
              )}
              pageIndex={
                pageIndex
              }
              pageCount={
                pages.length
              }
              paperStyle={
                paperStyle
              }
              paperSize={
                paperSize
              }
              updateItem={
                updateItem
              }
              removeItem={
                removeItem
              }
              addItem={() =>
                addItemAtPage(
                  pageIndex
                )
              }
            />
          )
        )}
      </div>
    </div>
  );
}

/* =========================================================
   PAGE PROPS
   ========================================================= */

interface PageProps
  extends Props {
  items: LineItem[];
  itemOffset: number;
  pageIndex: number;
  pageCount: number;

  updateItem: (
    id: string,
    patch: Partial<LineItem>
  ) => void;

  removeItem: (
    id: string
  ) => void;

  addItem: () => void;
}

/* =========================================================
   DOCUMENT PAGE
   ========================================================= */

const DocumentPage = memo(
  function DocumentPage({
    docType,
    state,
    setState,
    items,
    itemOffset,
    pageIndex,
    pageCount,
    paperStyle,
    paperSize,
    updateItem,
    removeItem,
    addItem,
  }: PageProps) {
    const isFirstPage =
      pageIndex === 0;

    const isTax =
      docType === "tax";

    const isChallan =
      docType === "dc";

    const isQuotation =
      docType === "quotation";

    const showAmounts =
      !isChallan;

    /* =====================================================
       TOTALS
       ===================================================== */

    const subtotal =
      state.items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          (item.qty || 0) *
            (item.rate || 0),
        0
      );

    const taxAmount =
      showAmounts
        ? subtotal *
          ((state.taxRate ||
            0) /
            100)
        : 0;

    const total =
      subtotal +
      taxAmount;

    /* =====================================================
       STATE SETTER
       ===================================================== */

    const set = <
      K extends keyof DocState
    >(
      key: K,
      value: DocState[K]
    ) =>
      setState(
        (current) => ({
          ...current,
          [key]: value,
        })
      );

    /* =====================================================
       PAGE
       ===================================================== */

    return (
      <article
        id={`paper-page-${pageIndex + 1}`}
        data-page-num={
          pageIndex + 1
        }
        className={`paper paper-${paperSize.toLowerCase()}`}
        style={{
          ...paperStyle,
          position: "relative",
        }}
        data-pdf-page
      >
        {/* TOP ACCENT */}

        <div className="top-accent" />

        <div
          className="document-content"
          style={{
            display: "flex",
            flexDirection:
              "column",
            justifyContent:
              "space-between",
            height: "100%",
            paddingBottom:
              "10px",
          }}
        >
          <div>
            {/* =================================================
                HEADER
                ================================================= */}

            <header
              className="document-header"
              style={{
                marginBottom:
                  "2px",
              }}
            >
              <img
                src={logoMark}
                alt="Logo"
                className="document-logo"
                style={{
                  maxHeight:
                    "68px",
                }}
              />
            </header>

            {/* =================================================
                IDENTITY GRID
                ================================================= */}

            <section
              className="identity-grid"
              style={{
                marginBottom:
                  "2px",
                gap: "8px",
              }}
            >
              {/* BILL TO */}

              <div className="bill-to">
                <h2
                  style={{
                    fontSize:
                      "24px",
                    fontWeight: 400,
                    marginBottom:
                      "2px",
                  }}
                >
                  BILL TO
                </h2>

                <TextField
                  value={
                    state.client
                      .name
                  }
                  onChange={(
                    value
                  ) =>
                    set(
                      "client",
                      {
                        ...state.client,
                        name: value,
                      }
                    )
                  }
                  placeholder="Client name"
                  ariaLabel="Client name"
                  className="client-name"
                  style={{
                    fontSize:
                      "10px",
                  }}
                />

                <ContactRow
                  icon={Phone}
                >
                  <TextField
                    value={
                      state.client
                        .phone
                    }
                    onChange={(
                      value
                    ) =>
                      set(
                        "client",
                        {
                          ...state.client,
                          phone: value,
                        }
                      )
                    }
                    placeholder="Phone number"
                    ariaLabel="Client phone"
                    style={{
                      fontSize:
                        "9px",
                    }}
                  />
                </ContactRow>

                <ContactRow
                  icon={Mail}
                >
                  <TextField
                    value={
                      state.client
                        .email
                    }
                    onChange={(
                      value
                    ) =>
                      set(
                        "client",
                        {
                          ...state.client,
                          email:
                            value,
                        }
                      )
                    }
                    placeholder="Email address"
                    ariaLabel="Client email"
                    style={{
                      fontSize:
                        "9px",
                    }}
                  />
                </ContactRow>

                <ContactRow
                  icon={MapPin}
                >
                  <AreaField
                    value={
                      state.client
                        .address
                    }
                    onChange={(
                      value
                    ) =>
                      set(
                        "client",
                        {
                          ...state.client,
                          address:
                            value,
                        }
                      )
                    }
                    placeholder="Client address"
                    ariaLabel="Client address"
                    style={{
                      fontSize:
                        "9px",
                    }}
                  />
                </ContactRow>

                <ContactRow
                  icon={Globe2}
                >
                  <TextField
                    value={
                      state.client
                        .website
                    }
                    onChange={(
                      value
                    ) =>
                      set(
                        "client",
                        {
                          ...state.client,
                          website:
                            value,
                        }
                      )
                    }
                    placeholder="Website"
                    ariaLabel="Client website"
                    style={{
                      fontSize:
                        "9px",
                    }}
                  />
                </ContactRow>
              </div>

              {/* =================================================
                  DOCUMENT META
                  ================================================= */}

              <div className="document-meta">
                <div
                  className="meta-grid"
                  style={{
                    fontSize:
                      "9px",
                    gap: "1px",
                  }}
                >
                  <MetaRow
                    label={
                      isTax
                        ? "STI #"
                        : isQuotation
                        ? "Quotation #"
                        : isChallan
                        ? "Challan #"
                        : "Invoice #"
                    }
                  >
                    <TextField
                      value={
                        state.meta
                          .number
                      }
                      onChange={(
                        value
                      ) =>
                        set(
                          "meta",
                          {
                            ...state.meta,
                            number:
                              value,
                          }
                        )
                      }
                      placeholder="#351-34"
                      ariaLabel="Document number"
                      align="right"
                      style={{
                        fontSize:
                          "9px",
                      }}
                    />
                  </MetaRow>

                  <MetaRow label="Document Date">
                    <TextField
                      value={
                        state.meta
                          .date
                      }
                      onChange={(
                        value
                      ) =>
                        set(
                          "meta",
                          {
                            ...state.meta,
                            date: value,
                          }
                        )
                      }
                      placeholder="DD/MM/YYYY"
                      ariaLabel="Document date"
                      align="right"
                      style={{
                        fontSize:
                          "9px",
                      }}
                    />
                  </MetaRow>

                  {!isChallan && (
                    <MetaRow
                      label={
                        isQuotation
                          ? "Valid Until"
                          : "Due Date"
                      }
                    >
                      <TextField
                        value={
                          isQuotation
                            ? state
                                .meta
                                .validUntil
                            : state
                                .meta
                                .dueDate
                        }
                        onChange={(
                          value
                        ) =>
                          set(
                            "meta",
                            {
                              ...state.meta,

                              [
                                isQuotation
                                  ? "validUntil"
                                  : "dueDate"
                              ]:
                                value,
                            }
                          )
                        }
                        placeholder="DD/MM/YYYY"
                        ariaLabel={
                          isQuotation
                            ? "Valid until"
                            : "Due date"
                        }
                        align="right"
                        style={{
                          fontSize:
                            "9px",
                        }}
                      />
                    </MetaRow>
                  )}
                </div>

                {/* =================================================
                    DOCUMENT TITLE
                    ================================================= */}

                <h1
                  className={`document-title document-title-${docType}`}
                  style={{
                    fontSize:
                      "36px",
                    fontWeight: 400,
                    marginTop:
                      "2px",
                  }}
                >
                  {
                    DOC_LABELS[
                      docType
                    ]
                  }
                </h1>
              </div>
            </section>

            {/* =================================================
                ITEMS TABLE
                ================================================= */}

            <section
              className="items-section"
              style={{
                marginBottom:
                  "2px",
              }}
            >
              <table>
                <thead>
                  <tr>
                    <th className="number-col">
                      No
                    </th>

                    <th>
                      Description
                    </th>

                    <th className="unit-col">
                      Unit
                    </th>

                    <th className="qty-col">
                      Qty
                    </th>

                    {showAmounts && (
                      <th className="unit-price-col">
                        Unit Price
                      </th>
                    )}

                    {showAmounts && (
                      <th className="amount-col">
                        Amount
                      </th>
                    )}

                    <th className="no-print action-col" />
                  </tr>
                </thead>

                <tbody>
                  {items.length >
                  0 ? (
                    items.map(
                      (
                        item,
                        index
                      ) => (
                        <tr
                          key={
                            item.id
                          }
                          style={{
                            height:
                              "18px",
                          }}
                        >
                          <td className="number-col">
                            {itemOffset +
                              index +
                              1}
                          </td>

                          <td className="description-col">
                            <AreaField
                              value={
                                item.description
                              }
                              onChange={(
                                value
                              ) =>
                                updateItem(
                                  item.id,
                                  {
                                    description:
                                      value,
                                  }
                                )
                              }
                              placeholder="Item or service description"
                              ariaLabel={`Description for row ${
                                itemOffset +
                                index +
                                1
                              }`}
                            />
                          </td>

                          <td className="unit-col">
                            <TextField
                              value={
                                item.unit
                              }
                              onChange={(
                                value
                              ) =>
                                updateItem(
                                  item.id,
                                  {
                                    unit:
                                      value,
                                  }
                                )
                              }
                              placeholder="pcs"
                              ariaLabel="Unit"
                              align="center"
                            />
                          </td>

                          <td className="qty-col">
                            <NumberField
                              value={
                                item.qty
                              }
                              onChange={(
                                value
                              ) =>
                                updateItem(
                                  item.id,
                                  {
                                    qty:
                                      value,
                                  }
                                )
                              }
                              ariaLabel="Quantity"
                            />
                          </td>

                          {showAmounts && (
                            <td className="unit-price-col unit-price">
                              <NumberField
                                value={
                                  item.rate
                                }
                                onChange={(
                                  value
                                ) =>
                                  updateItem(
                                    item.id,
                                    {
                                      rate:
                                        value,
                                    }
                                  )
                                }
                                ariaLabel="Unit price"
                                step={
                                  0.01
                                }
                              />
                            </td>
                          )}

                          {showAmounts && (
                            <td className="amount-col line-total">
                              {money(
                                (item.qty ||
                                  0) *
                                  (item.rate ||
                                    0),
                                state.currency
                              )}
                            </td>
                          )}

                          <td className="no-print action-col">
                            <Button
                              type="button"
                              size="icon"
                              variant="danger"
                              onClick={() =>
                                removeItem(
                                  item.id
                                )
                              }
                              aria-label="Remove row"
                            >
                              <Trash2
                                size={
                                  14
                                }
                              />
                            </Button>
                          </td>
                        </tr>
                      )
                    )
                  ) : (
                    <tr>
                      <td
                        colSpan={
                          showAmounts
                            ? 7
                            : 5
                        }
                        style={{
                          textAlign:
                            "center",
                          padding:
                            "10px",
                          color:
                            "#94a3b8",
                        }}
                      >
                        Continuation
                        Page{" "}
                        {pageIndex +
                          1}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* ADD ITEM */}

              <Button
                type="button"
                variant="ghost"
                className="no-print add-line"
                onClick={
                  addItem
                }
              >
                <Plus size={14} />
                Add line item
              </Button>
            </section>

            {/* =================================================
                TOTALS
                ================================================= */}

            {showAmounts && (
              <section
                className="totals"
                style={{
                  marginBottom:
                    "2px",
                }}
              >
                <div className="total-row">
                  <span>
                    Sub Total
                  </span>

                  <strong>
                    {money(
                      subtotal,
                      state.currency
                    )}
                  </strong>
                </div>

                <div className="total-row">
                  <span>
                    {isTax
                      ? "Sales Tax"
                      : "Taxes"}

                    <span className="tax-editor">
                      {" "}
                      (
                      <NumberField
                        value={
                          state.taxRate
                        }
                        onChange={(
                          value
                        ) =>
                          set(
                            "taxRate",
                            value
                          )
                        }
                        ariaLabel="Tax rate percent"
                      />
                      %)
                    </span>
                  </span>

                  <strong>
                    {money(
                      taxAmount,
                      state.currency
                    )}
                  </strong>
                </div>

                <div className="total-banner">
                  <span>
                    {isQuotation
                      ? "Estimate"
                      : "Total"}
                  </span>

                  <strong>
                    {money(
                      total,
                      state.currency
                    )}
                  </strong>
                </div>
              </section>
            )}
          </div>

          {/* =================================================
              CLOSING CONTENT
              ONLY FIRST PAGE
              ================================================= */}

          {isFirstPage && (
            <section
              className="closing-content"
              style={{
                marginTop:
                  "auto",
                paddingTop:
                  "4px",
              }}
            >
              <div className="terms-block">
                <h3>
                  Terms &amp;
                  Conditions
                </h3>

                <AreaField
                  value={
                    state.terms
                  }
                  onChange={(
                    value
                  ) =>
                    set(
                      "terms",
                      value
                    )
                  }
                  placeholder="Payment terms"
                  ariaLabel="Terms and conditions"
                />
              </div>

              <div className="payment-info">
                <div className="payment-details">
                  <strong>
                    Payment Info
                  </strong>

                  <AreaField
                    value={
                      state.paymentInfo
                    }
                    onChange={(
                      value
                    ) =>
                      set(
                        "paymentInfo",
                        value
                      )
                    }
                    placeholder="Bank, account, or payment instructions"
                    ariaLabel="Payment information"
                  />
                </div>

                <div className="signature-block">
                  Authorized
                  Signature
                </div>
              </div>

              <div className="thank-you">
                <span>
                  {isChallan
                    ? "Received in Good Order"
                    : "Thanks for your Business!"}
                </span>
              </div>
            </section>
          )}
        </div>

        {/* =================================================
            FOOTER
            ONLY FIRST PAGE
            ================================================= */}

        {isFirstPage && (
          <footer className="document-footer">
            <div
              className="footer-field"
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap: "6px",
                width: "100%",
                height: "100%",
              }}
            >
              <MapPin
                size={18}
                style={{
                  flexShrink: 0,
                }}
              />

              <textarea
                value={
                  state.footer
                    .address
                }
                onChange={(e) =>
                  set(
                    "footer",
                    {
                      ...state.footer,
                      address:
                        e.target
                          .value,
                    }
                  )
                }
                placeholder="Business address"
                aria-label="Business address"
                rows={1}
                style={{
                  width: "100%",
                  height:
                    "1.3em",
                  minHeight:
                    "1.3em",
                  background:
                    "transparent",
                  border: "none",
                  outline: "none",
                  resize:
                    "none",
                  color:
                    "inherit",
                  fontFamily:
                    "inherit",
                  fontSize:
                    "inherit",
                  lineHeight:
                    "1.3",
                  padding: "0",
                  margin: "0",
                  display:
                    "block",
                  overflow:
                    "hidden",
                }}
              />
            </div>

            <FooterFooterField
              icon={Phone}
            >
              <TextField
                value={
                  state.footer
                    .phone
                }
                onChange={(
                  value
                ) =>
                  set(
                    "footer",
                    {
                      ...state.footer,
                      phone: value,
                    }
                  )
                }
                placeholder="Phone"
                ariaLabel="Business phone"
              />
            </FooterFooterField>

            <FooterFooterField
              icon={Mail}
            >
              <TextField
                value={
                  state.footer
                    .email
                }
                onChange={(
                  value
                ) =>
                  set(
                    "footer",
                    {
                      ...state.footer,
                      email: value,
                    }
                  )
                }
                placeholder="Email"
                ariaLabel="Business email"
              />
            </FooterFooterField>
          </footer>
        )}

        {/* =================================================
            PAGE NUMBER
            ================================================= */}

        <div className="page-number no-print">
          Page{" "}
          {pageIndex + 1}{" "}
          of {pageCount}
        </div>
      </article>
    );
  }
);

/* =========================================================
   CONTACT ROW
   ========================================================= */

function ContactRow({
  icon: Icon,
  children,
}: {
  icon: typeof Phone;
  children: React.ReactNode;
}) {
  return (
    <div className="contact-row">
      <Icon size={14} />
      {children}
    </div>
  );
}

/* =========================================================
   META ROW
   ========================================================= */

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="meta-row">
      <span>
        {label}
      </span>

      <div>
        {children}
      </div>
    </div>
  );
}

/* =========================================================
   FOOTER FIELD
   ========================================================= */

function FooterFooterField({
  icon: Icon,
  children,
}: {
  icon: typeof Phone;
  children: React.ReactNode;
}) {
  return (
    <div
      className="footer-field"
      style={{
        display: "flex",
        alignItems:
          "center",
      }}
    >
      <Icon size={18} />
      {children}
    </div>
  );
}
