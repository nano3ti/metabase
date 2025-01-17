import { WRITABLE_DB_ID, SAMPLE_DB_ID } from "e2e/support/cypress_data";
import { SAMPLE_DATABASE } from "e2e/support/cypress_sample_database";
import { NO_COLLECTION_PERSONAL_COLLECTION_ID } from "e2e/support/cypress_sample_instance_data";
import {
  restore,
  visualize,
  openTable,
  openOrdersTable,
  popover,
  modal,
  summarize,
  startNewQuestion,
  entityPickerModal,
  entityPickerModalTab,
  questionInfoButton,
  rightSidebar,
  getNotebookStep,
  visitQuestionAdhoc,
  openNotebook,
  queryBuilderHeader,
  cartesianChartCircle,
  filter,
  moveColumnDown,
  getDraggableElements,
  resetTestTable,
  getTable,
  resyncDatabase,
  createQuestion,
  saveQuestion,
  echartsContainer,
  newButton,
  appBar,
  openProductsTable,
  queryBuilderFooter,
  enterCustomColumnDetails,
  addCustomColumn,
  tableInteractive,
  createNativeQuestion,
  queryBuilderMain,
  leftSidebar,
  assertQueryBuilderRowCount,
  visitDashboard,
  getDashboardCard,
  testTooltipPairs,
  join,
  visitQuestion,
  tableHeaderClick,
} from "e2e/support/helpers";

const { ORDERS, ORDERS_ID, PRODUCTS, PRODUCTS_ID, PEOPLE, PEOPLE_ID } =
  SAMPLE_DATABASE;

describe("issue 32625, issue 31635", () => {
  const CC_NAME = "Is Promotion";

  const QUESTION = {
    dataset_query: {
      type: "query",
      database: SAMPLE_DB_ID,
      query: {
        "source-table": ORDERS_ID,
        aggregation: [
          "distinct",
          ["field", ORDERS.PRODUCT_ID, { "base-type": "type/Integer" }],
        ],
        breakout: ["expression", CC_NAME],
        expressions: {
          [CC_NAME]: [
            "case",
            [[[">", ["field", ORDERS.DISCOUNT, null], 0], 1]],
            { default: 0 },
          ],
        },
      },
    },
  };
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
  });

  it("should remove dependent clauses when a clause is removed (metabase#32625, metabase#31635)", () => {
    visitQuestionAdhoc(QUESTION, { mode: "notebook" });

    getNotebookStep("expression")
      .findAllByTestId("notebook-cell-item")
      .first()
      .icon("close")
      .click();

    getNotebookStep("expression").should("not.exist");
    getNotebookStep("summarize").findByText(CC_NAME).should("not.exist");

    visualize();

    cy.findByTestId("query-builder-main").within(() => {
      cy.findByTestId("scalar-value").should("have.text", "200");
      cy.findByText("There was a problem with your question").should(
        "not.exist",
      );
    });
  });
});

describe("issue 32964", () => {
  const LONG_NAME = "A very long column name that will cause text overflow";

  const QUESTION = {
    dataset_query: {
      type: "query",
      database: SAMPLE_DB_ID,
      query: {
        "source-table": ORDERS_ID,
        expressions: {
          [LONG_NAME]: [
            "*",
            ["field", SAMPLE_DATABASE.ORDERS.SUBTOTAL, null],
            2,
          ],
        },
        aggregation: [["sum", ["expression", LONG_NAME]]],
        breakout: [
          [
            "field",
            SAMPLE_DATABASE.ORDERS.CREATED_AT,
            {
              "base-type": "type/DateTime",
              "temporal-unit": "week",
            },
          ],
        ],
      },
    },
  };
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
  });

  it("should not overflow chart settings sidebar with long column name (metabase#32964)", () => {
    visitQuestionAdhoc(QUESTION);
    cy.findByTestId("viz-settings-button").click();
    cy.findByTestId("sidebar-left").within(([sidebar]) => {
      const maxX = sidebar.getBoundingClientRect().right;
      cy.findByText(`Sum of ${LONG_NAME}`).then(([el]) => {
        const x = el.getBoundingClientRect().right;
        expect(x).to.be.lessThan(maxX);
      });
    });
  });
});

describe("issue 33079", () => {
  const questionDetails = {
    display: "line",
    query: {
      "source-table": ORDERS_ID,
      aggregation: [["count"]],
      breakout: [["field", ORDERS.CREATED_AT, { "temporal-unit": "month" }]],
    },
  };
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();

    cy.intercept("POST", "/api/dataset").as("dataset");
    cy.request("GET", "/api/user/current").then(({ body: user }) => {
      cy.request("PUT", `/api/user/${user.id}`, { locale: "de" });
    });
  });

  it("underlying records drill should work in a non-English locale (metabase#33079)", () => {
    cy.createQuestion(questionDetails, { visitQuestion: true });
    cartesianChartCircle().eq(1).click({ force: true });
    popover()
      .findByText(/Order/) // See these Orders
      .click();
    cy.wait("@dataset");
    cy.findByTestId("question-row-count").should("contain", "19");
  });
});

describe("issue 34414", () => {
  const { INVOICES_ID } = SAMPLE_DATABASE;

  const INVOICE_MODEL_DETAILS = {
    name: "Invoices Model",
    query: { "source-table": INVOICES_ID },
    type: "model",
  };
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
  });

  it("populate field values after re-adding filter on virtual table field (metabase#34414)", () => {
    cy.createQuestion(INVOICE_MODEL_DETAILS).then(response => {
      const modelId = response.body.id;

      visitQuestionAdhoc({
        dataset_query: {
          type: "query",
          database: SAMPLE_DB_ID,
          query: { "source-table": `card__${modelId}` },
        },
      });
    });

    openNotebook();
    filter({ mode: "notebook" });

    popover().within(() => {
      cy.findByText("Plan").click();
      assertPlanFieldValues();

      cy.log("Open filter again");
      cy.findByLabelText("Back").click();

      cy.log("Open plan field again");
      cy.findByText("Plan").click();

      assertPlanFieldValues();
    });
  });
});

function assertPlanFieldValues() {
  cy.findByText("Basic").should("be.visible");
  cy.findByText("Business").should("be.visible");
  cy.findByText("Premium").should("be.visible");
}

describe("issue 38176", () => {
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
    cy.intercept("PUT", "/api/card/**").as("updateQuestion");
  });

  it("restoring a question to a previous version should preserve the variables (metabase#38176)", () => {
    cy.createNativeQuestion(
      {
        name: "38176",
        native: {
          query:
            'SELECT "COUNTRY" from "ACCOUNTS" WHERE country = {{ country }} LIMIT 5',
          "template-tags": {
            country: {
              type: "text",
              id: "dd06cd10-596b-41d0-9d6e-94e98ceaf989",
              name: "country",
              "display-name": "Country",
            },
          },
        },
      },
      { visitQuestion: true },
    );

    cy.findByPlaceholderText("Country").type("NL");

    cy.findByTestId("query-builder-main").button("Get Answer").click();

    questionInfoButton().click();
    rightSidebar().within(() => {
      cy.findByText("History");

      cy.findByPlaceholderText("Add description")
        .type("This is a question")
        .blur();

      cy.wait("@updateQuestion");
      cy.findByText(/added a description/i);
      cy.findByTestId("question-revert-button").click();

      cy.findByText(/reverted to an earlier version/i).should("be.visible");
    });

    cy.findAllByRole("gridcell").should("contain", "NL");
  });
});

describe("issue 38354", { tags: "@external" }, () => {
  const QUESTION_DETAILS = {
    query: {
      "source-table": ORDERS_ID,
      limit: 5,
    },
  };
  beforeEach(() => {
    restore();
    restore("postgres-12");
    cy.signInAsAdmin();
    cy.createQuestion(QUESTION_DETAILS, { visitQuestion: true });
  });

  it("should be possible to change source database (metabase#38354)", () => {
    openNotebook();
    getNotebookStep("data").findByTestId("data-step-cell").click();
    entityPickerModal().within(() => {
      cy.findByText("QA Postgres12").click();
      cy.findByText("Orders").click();
    });

    // optimization: add a limit so that query runs faster
    cy.button("Row limit").click();
    getNotebookStep("limit").findByPlaceholderText("Enter a limit").type("5");

    visualize();

    cy.findByTestId("query-builder-main")
      .findByText("There was a problem with your question")
      .should("not.exist");
    cy.get("[data-testid=cell-data]").should("contain", "37.65"); // assert visualization renders the data
  });
});

describe("issue 30056", () => {
  const questionDetails = {
    query: {
      "source-query": {
        "source-table": PEOPLE_ID,
        aggregation: [["count"]],
        breakout: [
          ["field", PEOPLE.LATITUDE, { "base-type": "type/Float" }],
          ["field", PEOPLE.LONGITUDE, { "base-type": "type/Float" }],
        ],
      },
      filter: [">", ["field", "count", { "base-type": "type/Integer" }], 2],
    },
  };

  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
  });

  it("should show table breadcrumbs for questions with post-aggregation filters (metabase#30056)", () => {
    createQuestion(questionDetails, { visitQuestion: true });
    // the name of the table is hidden after a few seconds with a CSS animation,
    // so check for "exist" only
    queryBuilderHeader().findByText("People").should("exist");
  });
});

describe("issue 39102", () => {
  const questionDetails = {
    name: "39102",
    query: {
      "source-query": {
        "source-table": ORDERS_ID,
        aggregation: ["count"],
        breakout: [["field", ORDERS.CREATED_AT, { "temporal-unit": "year" }]],
      },
      filter: [">", ["field", "count", { "base-type": "type/Integer" }], 1000],
      aggregation: ["count"],
    },
    type: "question",
  };
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
    cy.intercept("POST", "/api/dataset").as("dataset");
  });

  it("should be able to preview a multi-stage query (metabase#39102)", () => {
    cy.createQuestion(questionDetails, { visitQuestion: true });
    openNotebook();

    getNotebookStep("data", { stage: 0 }).icon("play").click();
    cy.wait("@dataset");
    cy.findByTestId("preview-root").within(() => {
      cy.findByText("Tax").should("be.visible");
      cy.icon("close").click();
    });

    getNotebookStep("summarize", { stage: 0 }).icon("play").click();
    cy.wait("@dataset");
    cy.findByTestId("preview-root").within(() => {
      cy.findByText("Count").should("be.visible");
      cy.findByText("3,610").should("be.visible");
      cy.findByText("744").should("be.visible");
      cy.icon("close").click();
    });

    getNotebookStep("filter", { stage: 1 }).icon("play").click();
    cy.wait("@dataset");
    cy.findByTestId("preview-root").within(() => {
      cy.findByText("Count").should("be.visible");
      cy.findByText("3,610").should("be.visible");
      cy.findByText("744").should("not.exist");
      cy.icon("close").click();
    });

    getNotebookStep("summarize", { stage: 1 }).icon("play").click();
    cy.wait("@dataset");
    cy.findByTestId("preview-root").within(() => {
      cy.findByText("Count").should("be.visible");
      cy.findByText("4").should("be.visible");
    });
  });
});

describe("issue 13814", () => {
  const questionDetails = {
    display: "scalar",
    query: {
      "source-table": ORDERS_ID,
      aggregation: [
        ["count", ["field", ORDERS.TAX, { "base-type": "type/Float" }]],
      ],
    },
  };

  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
  });

  it("should support specifying a field in 'count' MBQL clause even if the UI doesn't support it (metabase#13814)", () => {
    cy.log("verify that the API supports saving this MBQL");
    createQuestion(questionDetails).then(({ body: card }) =>
      visitQuestion(card.id),
    );

    cy.log("verify that the query is executed correctly");
    cy.findByTestId("scalar-value").findByText("18,760").should("be.visible");

    cy.log(
      "verify that the clause is displayed correctly and won't crash if updated",
    );
    openNotebook();
    getNotebookStep("summarize")
      .findByText("Count of Tax")
      .should("be.visible")
      .click();
    popover().findByText("Count of rows").click();
    getNotebookStep("summarize").findByText("Count").should("be.visible");
  });
});

describe("issue 39795", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();

    //If you comment out this post, then the test will pass.
    cy.request("post", `/api/field/${ORDERS.PRODUCT_ID}/dimension`, {
      human_readable_field_id: PRODUCTS.TITLE,
      name: "Product ID",
      type: "external",
    });
  });

  it("should allow me to re-order even when a field is set with a different display value (metabase#39795)", () => {
    visitQuestionAdhoc({
      dataset_query: {
        database: SAMPLE_DB_ID,
        query: {
          "source-table": ORDERS_ID,
        },
        type: "query",
      },
    });
    cy.findByTestId("viz-settings-button").click();
    moveColumnDown(getDraggableElements().first(), 2);

    // We are not able to re-order because the dataset will also contain values a column for Product ID
    // This causes the isValid() check to fire, and you are always forced into the default value for table.columns
    getDraggableElements().eq(2).should("contain.text", "ID");
  });
});

describe("issue 40176", () => {
  const DIALECT = "postgres";
  const TABLE = "uuid_pk_table";
  beforeEach(() => {
    restore(`${DIALECT}-writable`);
    cy.signInAsAdmin();
    resetTestTable({ type: DIALECT, table: TABLE });
    resyncDatabase({
      dbId: WRITABLE_DB_ID,
      tableName: TABLE,
    });
  });

  it(
    "should allow filtering on UUID PK columns (metabase#40176)",
    { tags: "@external" },
    () => {
      getTable({ name: TABLE }).then(({ id: tableId }) => {
        visitQuestionAdhoc({
          display: "table",
          dataset_query: {
            database: WRITABLE_DB_ID,
            query: {
              "source-table": tableId,
            },
            type: "query",
          },
        });
      });
      openNotebook();
      cy.findByTestId("action-buttons").findByText("Filter").click();
      popover().within(() => {
        cy.findByText("ID").click();
        cy.findByLabelText("Filter value").type(
          "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        );
        cy.button("Add filter").click();
      });
      visualize();
      cy.findByTestId("question-row-count")
        .findByText("Showing 1 row")
        .should("be.visible");
    },
  );
});

describe("issue 40435", () => {
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
    cy.intercept("PUT", "/api/card/*").as("updateCard");
  });

  it("should make new query columns visible by default (metabase#40435)", () => {
    openOrdersTable();
    openNotebook();
    getNotebookStep("data").button("Pick columns").click();
    popover().within(() => {
      cy.findByText("Select none").click();
      cy.findByText("User ID").click();
    });
    getNotebookStep("data").button("Pick columns").click();
    visualize();
    cy.findByTestId("viz-settings-button").click();
    cy.findByTestId("sidebar-left").within(() => {
      cy.findByTestId("ID-hide-button").click();
      cy.findByTestId("ID-show-button").click();
    });
    saveQuestion();

    openNotebook();
    getNotebookStep("data").button("Pick columns").click();
    popover().findByText("Product ID").click();
    queryBuilderHeader().findByText("Save").click();
    modal().last().findByText("Save").click();
    cy.wait("@updateCard");
    visualize();

    cy.findByRole("columnheader", { name: "ID" }).should("be.visible");
    cy.findByRole("columnheader", { name: "User ID" }).should("be.visible");
    cy.findByRole("columnheader", { name: "Product ID" }).should("be.visible");
  });
});

describe("issue 41381", () => {
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
  });

  it("should show an error message when adding a constant-only custom expression (metabase#41381)", () => {
    openOrdersTable({ mode: "notebook" });
    addCustomColumn();
    enterCustomColumnDetails({ formula: "'Test'", name: "Constant" });
    popover().within(() => {
      cy.findByText("Invalid expression").should("be.visible");
      cy.button("Done").should("be.disabled");
    });
  });
});

describe(
  "issue 42010 -- Unable to filter by mongo id",
  { tags: "@mongo" },
  () => {
    beforeEach(() => {
      restore("mongo-5");
      cy.signInAsAdmin();

      cy.intercept("POST", "/api/dataset").as("dataset");
      cy.request(`/api/database/${WRITABLE_DB_ID}/schema/`).then(({ body }) => {
        const tableId = body.find(table => table.name === "orders").id;
        openTable({
          database: WRITABLE_DB_ID,
          table: tableId,
          limit: 2,
        });
      });
      cy.wait("@dataset");
    });

    it("should be possible to filter by Mongo _id column (metabase#40770, metabase#42010)", () => {
      cy.get("#main-data-grid")
        .findAllByRole("gridcell")
        .first()
        .then($cell => {
          // Ids are non-deterministic so we have to obtain the id from the cell, and store its value.
          const id = $cell.text();

          cy.log(
            "Scenario 1 - Make sure the simple mode filter is working correctly (metabase#40770)",
          );
          filter();

          cy.findByRole("dialog").within(() => {
            cy.findByPlaceholderText("Search by ID").type(id);
            cy.button("Apply filters").click();
          });

          cy.findByTestId("question-row-count").should(
            "have.text",
            "Showing 1 row",
          );
          removeFilter();

          cy.log(
            "Scenario 2 - Make sure filter is working in the notebook editor (metabase#42010)",
          );
          openNotebook();
          filter({ mode: "notebook" });

          popover()
            .findAllByRole("option")
            .first()
            .should("have.text", "ID")
            .click();

          cy.findByTestId("string-filter-picker").within(() => {
            cy.findByLabelText("Filter operator").should("have.value", "Is");
            cy.findByPlaceholderText("Search by ID").type(id);
            cy.button("Add filter").click();
          });

          cy.findByTestId("step-filter-0-0").within(() => {
            cy.findByText(`ID is ${id}`);

            cy.log(
              "Scenario 2.1 - Trigger the preview to make sure it reflects the filter correctly",
            );
            cy.icon("play").click();
          });

          // The preview should show only one row
          const ordersColumns = 10;
          cy.findByTestId("preview-root")
            .get("#main-data-grid")
            .findAllByTestId("cell-data")
            .should("have.length.at.most", ordersColumns);

          cy.log("Scenario 2.2 - Make sure we can visualize the data");
          visualize();
          cy.findByTestId("question-row-count").should(
            "have.text",
            "Showing 1 row",
          );
        });
    });
  },
);

function removeFilter() {
  cy.findByTestId("filter-pill").findByLabelText("Remove").click();
  cy.findByTestId("question-row-count").should("have.text", "Showing 2 rows");
}

describe("issue 33439", () => {
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
  });

  it("should show an error message when trying to use convertTimezone on an unsupported db (metabase#33439)", () => {
    openOrdersTable({ mode: "notebook" });
    addCustomColumn();
    enterCustomColumnDetails({
      formula:
        'convertTimezone("2022-12-28T12:00:00", "Canada/Pacific", "Canada/Eastern")',
      name: "Date",
    });
    popover().within(() => {
      cy.findByText("Unsupported function convert-timezone");
      cy.button("Done").should("be.disabled");
    });
  });
});

describe("issue 42244", () => {
  const COLUMN_NAME = "Created At".repeat(5);

  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
    cy.request("PUT", `/api/field/${ORDERS.CREATED_AT}`, {
      display_name: COLUMN_NAME,
    });
  });

  it("should allow to change the temporal bucket when the column name is long (metabase#42244)", () => {
    openOrdersTable({ mode: "notebook" });
    summarize({ mode: "notebook" });
    getNotebookStep("summarize")
      .findByText("Pick a column to group by")
      .click();
    popover().within(() => {
      cy.findByText(COLUMN_NAME).realHover();
      cy.findByText("by month").should("be.visible").click();
    });
    popover().last().findByText("Year").click();
    getNotebookStep("summarize")
      .findByText(`${COLUMN_NAME}: Year`)
      .should("be.visible");
  });
});

describe("issue 42957", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
  });

  it("does not show collections that contain models from different tabs (metabase#42957)", () => {
    createQuestion({
      name: "Model",
      type: "model",
      query: {
        "source-table": ORDERS_ID,
      },
    });

    cy.createCollection({ name: "Collection without models" }).then(
      ({ body: collection }) => {
        cy.wrap(collection.id).as("collectionId");
      },
    );

    cy.get("@collectionId").then(collectionId => {
      createQuestion({
        name: "Question",
        type: "question",
        query: {
          "source-table": ORDERS_ID,
        },
        collection_id: collectionId,
      });
    });

    startNewQuestion();
    entityPickerModal().within(() => {
      entityPickerModalTab("Models").click();

      cy.findByText("Collection without models").should("not.exist");
    });
  });
});

describe("issue 40064", () => {
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
  });

  it("should be able to edit a custom column with the same name as one of the columns used in the expression (metabase#40064)", () => {
    createQuestion(
      {
        query: {
          "source-table": ORDERS_ID,
          expressions: {
            Tax: ["*", ["field", ORDERS.TAX, { "base-type": "type/Float" }], 2],
          },
          limit: 1,
        },
      },
      { visitQuestion: true },
    );

    cy.log("check the initial expression value");
    tableInteractive().findByText("4.14").should("be.visible");

    cy.log("update the expression and check the value");
    openNotebook();
    getNotebookStep("expression").findByText("Tax").click();
    enterCustomColumnDetails({ formula: "[Tax] * 3" });
    popover().button("Update").click();
    visualize();
    tableInteractive().findByText("6.21").should("be.visible");

    cy.log("rename the expression and make sure you cannot create a cycle");
    openNotebook();
    getNotebookStep("expression").findByText("Tax").click();
    enterCustomColumnDetails({ formula: "[Tax] * 3", name: "Tax3" });
    popover().button("Update").click();
    getNotebookStep("expression").findByText("Tax3").click();
    enterCustomColumnDetails({ formula: "[Tax3] * 3", name: "Tax3" });
    popover().within(() => {
      cy.findByText("Unknown Field: Tax3").should("be.visible");
      cy.button("Update").should("be.disabled");
    });
  });
});

describe.skip("issue 10493", () => {
  beforeEach(() => {
    restore();
    cy.intercept("POST", "/api/dataset").as("dataset");
    cy.signInAsAdmin();
  });

  it("should not reset chart axes after adding a new query stage (metabase#10493)", () => {
    visitQuestionAdhoc({
      display: "bar",
      dataset_query: {
        type: "query",
        database: SAMPLE_DB_ID,
        query: {
          aggregation: [["count"]],
          breakout: [
            [
              "field",
              ORDERS.QUANTITY,
              { "base-type": "type/Integer", binning: { strategy: "default" } },
            ],
          ],
          "source-table": ORDERS_ID,
        },
      },
    });

    filter();
    modal().within(() => {
      cy.findByText("Summaries").click();
      cy.findByTestId("filter-column-Count").within(() => {
        cy.findByPlaceholderText("Min").type("0");
        cy.findByPlaceholderText("Max").type("30000");
      });
      cy.button("Apply filters").click();
    });
    cy.wait("@dataset");

    echartsContainer().within(() => {
      // y axis
      cy.findByText("Count").should("exist");
      cy.findByText("21,000").should("exist");
      cy.findByText("3,000").should("exist");

      // x axis
      cy.findByText("Quantity").should("exist");
      cy.findByText("25").should("exist");
      cy.findByText("75").should("exist");
    });
  });
});

describe("issue 32020", () => {
  const question1Details = {
    name: "Q1",
    query: {
      "source-table": ORDERS_ID,
      aggregation: [
        ["sum", ["field", ORDERS.TOTAL, { "base-type": "type/Float" }]],
      ],
      breakout: [
        ["field", ORDERS.ID, { "base-type": "type/BigInteger" }],
        [
          "field",
          ORDERS.CREATED_AT,
          { "base-type": "type/DateTime", "temporal-unit": "month" },
        ],
      ],
    },
  };

  const question2Details = {
    name: "Q2",
    query: {
      "source-table": PEOPLE_ID,
      aggregation: [
        ["max", ["field", PEOPLE.LONGITUDE, { "base-type": "type/Float" }]],
      ],
      breakout: [
        ["field", PEOPLE.ID, { "base-type": "type/BigInteger" }],
        [
          "field",
          PEOPLE.CREATED_AT,
          { "base-type": "type/DateTime", "temporal-unit": "month" },
        ],
      ],
    },
  };

  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
    createQuestion(question1Details);
    createQuestion(question2Details);
  });

  it("should be possible to use aggregation columns from source and joined questions in aggregation (metabase#32020)", () => {
    startNewQuestion();

    cy.log("create joined question manually");
    entityPickerModal().within(() => {
      entityPickerModalTab("Saved questions").click();
      cy.findByText(question1Details.name).click();
    });
    join();
    entityPickerModal().within(() => {
      entityPickerModalTab("Saved questions").click();
      cy.findByText(question2Details.name).click();
    });
    popover().findByText("ID").click();
    popover().findByText("ID").click();

    cy.log("aggregation column from the source question");
    getNotebookStep("summarize")
      .findByText(/Pick the metric/)
      .click();
    popover().within(() => {
      cy.findByText("Sum of ...").click();
      cy.findByText("Sum of Total").click();
    });

    cy.log("aggregation column from the joined question");
    getNotebookStep("summarize").icon("add").click();
    popover().within(() => {
      cy.findByText("Sum of ...").click();
      cy.findByText(question2Details.name).click();
      cy.findByText("Max of Longitude").click();
    });

    cy.log("visualize and check results");
    visualize();
    tableInteractive().within(() => {
      cy.findByText("Sum of Sum of Total").should("be.visible");
      cy.findByText("Sum of Q2 → Max").should("be.visible");
    });
  });
});

describe("issue 44071", () => {
  const questionDetails = {
    name: "Test",
    query: { "source-table": ORDERS_ID },
    collection_id: NO_COLLECTION_PERSONAL_COLLECTION_ID,
  };

  beforeEach(() => {
    restore();
    cy.signIn("nocollection");
    createQuestion(questionDetails);
  });

  it("should be able to save questions based on another questions without collection access (metabase#44071)", () => {
    cy.visit("/");
    newButton("Question").click();
    entityPickerModal().within(() => {
      entityPickerModalTab("Saved questions").click();
      cy.findByText(/Personal Collection/).click();
      cy.findByText(questionDetails.name).click();
    });
    getNotebookStep("data")
      .findByText(questionDetails.name)
      .should("be.visible");
    saveQuestion();
    appBar()
      .findByText(/Personal Collection/)
      .should("be.visible");
  });
});

describe("issue 44415", () => {
  beforeEach(() => {
    restore();
    cy.signIn("admin");
    createQuestion(
      {
        query: {
          "source-table": ORDERS_ID,
          filter: [
            "and",
            [
              "not-null",
              ["field", ORDERS.DISCOUNT, { "base-type": "type/Float" }],
            ],
          ],
        },
        visualization_settings: {
          "table.columns": [
            {
              name: "ID",
              fieldRef: ["field", ORDERS.ID, null],
              enabled: true,
            },
            {
              name: "DISCOUNT",
              fieldRef: ["field", ORDERS.DISCOUNT, null],
              enabled: true,
            },
          ],
        },
      },
      { wrapId: true },
    );
  });

  it("should be able to edit a table question in the notebook editor before running its query (metabase#44415)", () => {
    cy.get("@questionId").then(questionId =>
      cy.visit(`/question/${questionId}/notebook`),
    );

    getNotebookStep("filter")
      .findAllByTestId("notebook-cell-item")
      .first()
      .icon("close")
      .click();

    getNotebookStep("filter").should("not.exist");

    visualize();

    cy.findByTestId("qb-filters-panel").should("not.exist");
    cy.get("@questionId").then(questionId => {
      cy.url().should("not.include", `/question/${questionId}`);
      cy.url().should("include", "question#");
    });
  });
});

describe("issue 37374", () => {
  const questionDetails = {
    query: {
      "source-table": PRODUCTS_ID,
      aggregation: [["count"]],
      breakout: [
        ["field", PRODUCTS.CATEGORY, { "base-type": "type/Text" }],
        ["field", PRODUCTS.VENDOR, { "base-type": "type/Text" }],
      ],
    },
  };

  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
    createQuestion(questionDetails, { wrapId: true });
    cy.signIn("nodata");
  });

  it("should allow to change the viz type to pivot without data access (metabase#37374)", () => {
    visitQuestion("@questionId");
    cy.intercept("POST", "/api/card/*/query").as("cardQuery");
    cy.intercept("POST", "/api/card/pivot/*/query").as("cardPivotQuery");

    cy.log("changing the viz type to pivot table and running the query works");
    cy.findByTestId("viz-type-button").click();
    cy.findByTestId("chart-type-sidebar")
      .findByTestId("Pivot Table-button")
      .click();
    cy.wait("@cardPivotQuery");
    cy.findByTestId("pivot-table").should("be.visible");

    cy.log("changing the viz type back to table and running the query works");
    cy.findByTestId("chart-type-sidebar").findByTestId("Table-button").click();
    cy.wait("@cardQuery");
    tableInteractive().should("be.visible");
  });
});

describe("issue 44532", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
    openProductsTable();
  });

  it("should update chart metrics and dimensions with each added breakout (metabase #44532)", () => {
    summarize();

    rightSidebar()
      .findByRole("listitem", { name: "Category" })
      .button("Add dimension")
      .click();
    cy.wait("@dataset");

    echartsContainer().within(() => {
      cy.findByText("Count").should("exist"); // y-axis
      cy.findByText("Category").should("exist"); // x-axis

      // x-axis values
      cy.findByText("Doohickey").should("exist");
      cy.findByText("Gadget").should("exist");
      cy.findByText("Gizmo").should("exist");
      cy.findByText("Widget").should("exist");
    });

    rightSidebar()
      .findByRole("listitem", { name: "Created At" })
      .button("Add dimension")
      .click();
    cy.wait("@dataset");

    cy.findByLabelText("Legend").within(() => {
      cy.findByText("Doohickey").should("exist");
      cy.findByText("Gadget").should("exist");
      cy.findByText("Gizmo").should("exist");
      cy.findByText("Widget").should("exist");
    });

    echartsContainer().within(() => {
      cy.findByText("Count").should("exist"); // y-axis
      cy.findByText("Created At").should("exist"); // x-axis

      // x-axis values
      cy.findByText("January 2023").should("exist");
      cy.findByText("January 2024").should("exist");
      cy.findByText("January 2025").should("exist");

      // previous x-axis values
      cy.findByText("Doohickey").should("not.exist");
      cy.findByText("Gadget").should("not.exist");
      cy.findByText("Gizmo").should("not.exist");
      cy.findByText("Widget").should("not.exist");
    });

    rightSidebar().button("Done").click();
    cy.wait("@dataset");

    cy.findByLabelText("Legend").within(() => {
      cy.findByText("Doohickey").should("exist");
      cy.findByText("Gadget").should("exist");
      cy.findByText("Gizmo").should("exist");
      cy.findByText("Widget").should("exist");
    });

    echartsContainer().within(() => {
      cy.findByText("Count").should("exist"); // y-axis
      cy.findByText("Created At").should("exist"); // x-axis

      // x-axis values
      cy.findByText("January 2023").should("exist");
      cy.findByText("January 2024").should("exist");
      cy.findByText("January 2025").should("exist");

      // previous x-axis values
      cy.findByText("Doohickey").should("not.exist");
      cy.findByText("Gadget").should("not.exist");
      cy.findByText("Gizmo").should("not.exist");
      cy.findByText("Widget").should("not.exist");
    });
  });
});

describe("issue 33441", () => {
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
  });

  it("should show an error message for an incorrect date expression (metabase#33441)", () => {
    openOrdersTable({ mode: "notebook" });
    addCustomColumn();
    enterCustomColumnDetails({
      formula: 'datetimeDiff([Created At] , now, "days")',
      name: "Date",
    });
    popover().within(() => {
      cy.findByText("Invalid expression").should("be.visible");
      cy.button("Done").should("be.disabled");
    });
  });
});

describe("issue 31960", () => {
  const questionDetails = {
    query: {
      "source-table": ORDERS_ID,
      aggregation: [["count"]],
      breakout: [["field", ORDERS.CREATED_AT, { "temporal-unit": "week" }]],
    },
    display: "line",
    visualization_settings: {
      "graph.metrics": ["count"],
      "graph.dimensions": ["CREATED_AT"],
    },
  };

  // the dot that corresponds to July 10–16, 2022
  const dotIndex = 10;
  const rowCount = 11;

  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
  });

  it("should apply a date range filter for a query broken out by week (metabase#31960)", () => {
    cy.createDashboardWithQuestions({ questions: [questionDetails] }).then(
      ({ dashboard }) => {
        visitDashboard(dashboard.id);
      },
    );

    getDashboardCard().within(() => {
      cartesianChartCircle().eq(dotIndex).realHover();
    });
    testTooltipPairs([
      ["Created At:", "July 10–16, 2022"],
      ["Count:", String(rowCount)],
      ["Compared to previous week", "+10%"],
    ]);
    getDashboardCard().within(() => {
      cartesianChartCircle().eq(dotIndex).click({ force: true });
    });

    popover().findByText("See these Orders").click();
    cy.findByTestId("qb-filters-panel")
      .findByText("Created At is Jul 10–16, 2022")
      .should("be.visible");
    assertQueryBuilderRowCount(rowCount);
  });
});

describe("issue 43294", () => {
  const questionDetails = {
    display: "line",
    query: {
      "source-table": ORDERS_ID,
      aggregation: [["count"]],
      breakout: [["field", ORDERS.CREATED_AT, { "temporal-unit": "month" }]],
    },
    visualization_settings: {
      "graph.metrics": ["count"],
      "graph.dimensions": ["CREATED_AT"],
    },
  };

  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
  });

  it("should not overwrite viz settings with click actions in raw data mode (metabase#43294)", () => {
    createQuestion(questionDetails, { visitQuestion: true });
    queryBuilderFooter().findByLabelText("Switch to data").click();

    cy.log("compare action");
    cy.button("Add column").click();
    popover().findByText("Compare “Count” to previous months").click();
    popover().button("Done").click();

    cy.log("extract action");
    cy.button("Add column").click();
    popover().findByText("Extract part of column").click();
    popover().within(() => {
      cy.findByText("Created At: Month").click();
      cy.findByText("Year").click();
    });

    cy.log("combine action");
    cy.button("Add column").click();
    popover().findByText("Combine columns").click();
    popover().button("Done").click();

    cy.log("check visualization");
    queryBuilderFooter().findByLabelText("Switch to visualization").click();
    echartsContainer().within(() => {
      cy.findByText("Count").should("be.visible");
      cy.findByText("Created At").should("be.visible");
    });
  });
});

describe("issue 40399", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
  });

  it("should not show results from other stages in a stages preview (metabase#40399)", () => {
    createQuestion(
      {
        name: "40399",
        query: {
          "source-table": PRODUCTS_ID,
          joins: [
            {
              fields: "all",
              alias: "Orders",
              "source-table": ORDERS_ID,
              strategy: "left-join",
              condition: [
                "=",
                ["field", PRODUCTS.ID, null],
                ["field", ORDERS.PRODUCT_ID, { "join-alias": "Orders" }],
              ],
            },
          ],
          filter: ["=", ["field", PRODUCTS.CATEGORY, null], "Widget"],
        },
      },
      {
        visitQuestion: true,
      },
    );

    openNotebook();

    getNotebookStep("filter", { stage: 0 }).within(() => {
      cy.icon("play").click();
      cy.findByTestId("preview-root")
        .findAllByText("Widget")
        .should("be.visible");
    });

    getNotebookStep("join", { stage: 0 }).within(() => {
      cy.icon("play").click();
      cy.findByTestId("preview-root")
        .findAllByText("Gizmo")
        .should("be.visible");

      cy.findByTestId("preview-root").findByText("Widget").should("not.exist");
    });

    getNotebookStep("data", { stage: 0 }).within(() => {
      cy.icon("play").click();
      cy.findByTestId("preview-root")
        .findAllByText("Gizmo")
        .should("be.visible");

      cy.findByTestId("preview-root").findAllByText("Gizmo").should("exist");
      cy.findByTestId("preview-root").findAllByText("Widget").should("exist");
    });
  });
});

describe("issue 43057", () => {
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
  });

  it("should differentiate between date and datetime filters with 00:00 time (metabase#43057)", () => {
    openOrdersTable();

    cy.log("set the date and verify the filter and results");
    cy.intercept("POST", "/api/dataset").as("dataset");
    tableHeaderClick("Created At");
    popover().within(() => {
      cy.findByText("Filter by this column").click();
      cy.findByText("Specific dates…").click();
      cy.findByText("On").click();
      cy.findByLabelText("Date").clear().type("November 18, 2024");
      cy.button("Add filter").click();
    });
    cy.wait("@dataset");
    assertQueryBuilderRowCount(16);
    cy.findByTestId("qb-filters-panel")
      .findByText("Created At is on Nov 18, 2024")
      .should("be.visible");

    cy.log("set time to 00:00 and verify the filter and results");
    cy.findByTestId("qb-filters-panel")
      .findByText("Created At is on Nov 18, 2024")
      .click();
    popover().within(() => {
      cy.button("Add time").click();
      cy.findByLabelText("Time").should("have.value", "00:00");
      cy.button("Update filter").click();
    });
    cy.wait("@dataset");
    assertQueryBuilderRowCount(1);
    cy.findByTestId("qb-filters-panel")
      .findByText("Created At is Nov 18, 2024, 12:00 AM")
      .should("be.visible");

    cy.log("remove time and verify the filter and results");
    cy.findByTestId("qb-filters-panel")
      .findByText("Created At is Nov 18, 2024, 12:00 AM")
      .click();
    popover().within(() => {
      cy.findByLabelText("Time").should("have.value", "00:00");
      cy.button("Remove time").click();
      cy.button("Update filter").click();
    });
    cy.wait("@dataset");
    assertQueryBuilderRowCount(16);
    cy.findByTestId("qb-filters-panel")
      .findByText("Created At is on Nov 18, 2024")
      .should("be.visible");
  });
});

describe("issue 19894", () => {
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
  });

  it("should show all columns when using the join column selecter (metabase#19894)", () => {
    createQuestion(
      {
        name: "Q1",
        query: {
          "source-table": PRODUCTS_ID,
          aggregation: [["count"]],
          breakout: [["field", PRODUCTS.CATEGORY, null]],
        },
      },
      {
        wrapId: true,
      },
    );

    createQuestion({
      name: "Q2",
      query: {
        "source-table": PRODUCTS_ID,
        aggregation: [["sum", ["field", PRODUCTS.PRICE, null]]],
        breakout: [["field", PRODUCTS.CATEGORY, null]],
      },
    });

    createQuestion({
      name: "Q3",
      query: {
        "source-table": PRODUCTS_ID,
        aggregation: [["avg", ["field", PRODUCTS.RATING, null]]],
        breakout: [["field", PRODUCTS.CATEGORY, null]],
      },
    });

    startNewQuestion();

    modal().findByText("Saved questions").click();
    modal().findByText("Q1").click();

    cy.button("Join data").click();

    modal().findByText("Saved questions").click();
    modal().findByText("Q2").click();

    popover().findByText("Category").click();
    popover().findByText("Category").click();

    cy.button("Join data").click();

    modal().findByText("Saved questions").click();
    modal().findByText("Q3").click();

    popover().findByText("Category").should("be.visible");
    popover().findByText("Count").should("be.visible");

    popover().findByText("Q1").click();
    popover().findByText("Q2").click();

    popover().findByText("Category").should("be.visible");
    popover().findByText("Sum of Price").should("be.visible");

    popover().findByText("Q1").click();

    popover().findByText("Category").should("be.visible");
    popover().findByText("Count").should("be.visible");
  });
});

describe("issue 44637", () => {
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
  });

  it("should not crash when rendering a line/bar chart with empty results (metabase#44637)", () => {
    createNativeQuestion(
      {
        native: {
          query: "SELECT '2023-01-01'::date, 2 FROM people WHERE false",
        },
      },
      { visitQuestion: true },
    );

    assertQueryBuilderRowCount(0);
    queryBuilderMain().findByText("No results!").should("exist");
    queryBuilderFooter().button("Visualization").click();
    leftSidebar().icon("bar").click();
    queryBuilderMain().within(() => {
      cy.findByText("No results!").should("exist");
      cy.findByText("Something's gone wrong").should("not.exist");
    });

    queryBuilderFooter().icon("calendar").click();
    rightSidebar().findByText("Add an event");
  });
});

describe("issue 44668", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
  });

  it("should not drop graph.metrics after adding a new query stage (metabase#44668)", () => {
    createQuestion(
      {
        display: "bar",
        query: {
          aggregation: [["count"]],
          breakout: [["field", PEOPLE.STATE, { "base-type": "type/Text" }]],
          "source-table": PEOPLE_ID,
          limit: 5,
        },
        visualization_settings: {
          "graph.metrics": ["count"],
          "graph.dimensions": ["STATE"],
        },
      },
      { visitQuestion: true },
    );

    openNotebook();

    cy.findAllByTestId("action-buttons").last().button("Custom column").click();
    enterCustomColumnDetails({
      formula: 'concat("abc_", [Count])',
      name: "Custom String",
    });
    popover().button("Done").click();

    getNotebookStep("expression", { stage: 1 }).icon("add").click();
    enterCustomColumnDetails({ formula: "[Count] * 2", name: "Custom Number" });
    popover().button("Done").click();

    visualize();

    echartsContainer().within(() => {
      cy.findByText("State").should("be.visible"); // x-axis
      cy.findByText("Count").should("be.visible"); // y-axis

      // x-axis values
      ["AK", "AL", "AR", "AZ", "CA"].forEach(state => {
        cy.findByText(state).should("be.visible");
      });
    });

    // Ensure custom columns weren't added as series automatically
    queryBuilderMain().findByLabelText("Legend").should("not.exist");

    cy.findByTestId("viz-settings-button").click();

    // Ensure can use Custom Number as series
    leftSidebar().findByText("Add another series").click();
    queryBuilderMain()
      .findByLabelText("Legend")
      .within(() => {
        cy.findByText("Count").should("exist");
        cy.findByText("Custom Number").should("exist");
      });
    leftSidebar().within(() => {
      cy.findByText("Add another series").should("not.exist");
      cy.findByText("Add series breakout").should("not.exist");
      cy.findByTestId("remove-Custom Number").click();
    });
    queryBuilderMain().findByLabelText("Legend").should("not.exist");

    leftSidebar().findByText("Add series breakout").click();
    popover().within(() => {
      cy.findByText("Count").should("exist");
      cy.findByText("Custom Number").should("exist");
      cy.findByText("Custom String").click();
    });
    queryBuilderMain()
      .findByLabelText("Legend")
      .within(() => {
        ["68", "56", "49", "20", "90"].forEach(value => {
          cy.findByText(`abc_${value}`).should("exist");
        });
      });
    leftSidebar().within(() => {
      cy.findByText("Add another series").should("not.exist");
      cy.findByText("Add series breakout").should("not.exist");
    });
  });
});

// TODO: unskip when metabase#44974 is fixed
describe.skip(
  "issue 44974",
  {
    tags: ["@external"],
  },
  () => {
    beforeEach(() => {
      restore("postgres-writable");
      cy.signInAsAdmin();
    });
    it("should not be possible to join with a table or question which is not in the same database (metabase#44974)", () => {
      startNewQuestion();
      entityPickerModal().within(() => {
        entityPickerModalTab("Tables").click();
        cy.findByText("Sample Database").click();
        cy.findByText("Orders").click();
      });

      cy.button("Visualize").click();
      cy.button("Save").click();
      modal().button("Save").click();

      cy.wait(300);
      modal().button("Not now").click();

      startNewQuestion();
      entityPickerModal().within(() => {
        entityPickerModalTab("Tables").click();
        cy.findByText("Writable Postgres12").click();
        cy.findByText("Scoreboard Actions").click();
      });

      join();

      entityPickerModal().within(() => {
        entityPickerModalTab("Recents").click();
        cy.findByText("Orders").should("not.exist");
      });
    });
  },
);

describe("issue 38989", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
  });

  it("should be impossible to join with a table or question which is not in the same database (metabase#38989)", () => {
    createQuestion(
      {
        query: {
          "source-table": PEOPLE_ID,
          fields: [
            ["field", PEOPLE.ID, { "base-type": "type/Number" }],
            ["field", PEOPLE.EMAIL, { "base-type": "type/Text" }],
          ],
          joins: [
            {
              fields: "all",
              alias: "Orders",
              // This is not a valid table ID in the Sample Database
              "source-table": 123,
              strategy: "left-join",
              condition: [
                "=",
                ["field", PEOPLE.ID, null],
                ["field", ORDERS.USER_ID, { "join-alias": "Orders" }],
              ],
            },
          ],
        },
      },
      {
        visitQuestion: true,
      },
    );

    cy.findByTestId("query-builder-main")
      .findByText("Show error details")
      .click();

    cy.findByTestId("query-builder-main")
      .findByText(
        /either it does not exist, or it belongs to a different Database/,
      )
      .should("exist");
  });
});

describe("issue 39771", () => {
  beforeEach(() => {
    restore();
    cy.signInAsNormalUser();
  });

  it("should show tooltip for ellipsified text (metabase#39771)", () => {
    createQuestion(
      {
        query: {
          aggregation: [["count"]],
          breakout: [
            [
              "field",
              "CREATED_AT",
              {
                "base-type": "type/DateTime",
                "temporal-unit": "quarter-of-year",
              },
            ],
          ],
          "source-query": {
            "source-table": ORDERS_ID,
            aggregation: [["count"]],
            breakout: [
              [
                "field",
                ORDERS.CREATED_AT,
                {
                  "base-type": "type/DateTime",
                  "temporal-unit": "month",
                },
              ],
            ],
          },
        },
      },
      { visitQuestion: true },
    );

    openNotebook();
    getNotebookStep("summarize", { stage: 1 })
      .findByTestId("breakout-step")
      .findByText("Created At: Month: Quarter of year")
      .click();

    popover().findByText("by quarter of year").realHover();

    popover().then(([$popover]) => {
      const popoverStyle = window.getComputedStyle($popover);
      const popoverZindex = parseInt(popoverStyle.zIndex, 10);

      cy.findByTestId("ellipsified-tooltip").within(([$tooltip]) => {
        cy.findByText("by quarter of year").should("be.visible");

        const tooltipStyle = window.getComputedStyle($tooltip);
        const tooltipZindex = parseInt(tooltipStyle.zIndex, 10);

        // resort to asserting zIndex because should("be.visible") passes unexpectedly
        expect(tooltipZindex).to.be.gte(popoverZindex);
      });
    });
  });
});
