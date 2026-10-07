require("dotenv").config();

const connectDB = require("./src/config/db");
const { getPropertyRiskScore } = require("./src/services/propertyRiskService");

const runTest = async () => {
  try {
    await connectDB();

    const propertyId = "6aa97840f532befd1c175245";

    console.log("\n========================================");
    console.log("PROPERTY RISK SERVICE TEST");
    console.log("========================================\n");

    console.log(`Testing property: ${propertyId}\n`);

    const result = await getPropertyRiskScore(propertyId);

    console.log("RISK RESULT");
    console.log("----------------------------------------");
    console.log(`Property:    ${result.propertyTitle}`);
    console.log(`Score:       ${result.score}/100`);
    console.log(`Level:       ${result.level}`);
    console.log(`Confidence:  ${result.confidence}`);
    console.log(`Summary:     ${result.summary}`);

    console.log("\nFACTORS");
    console.log("----------------------------------------");

    result.factors.forEach((factor) => {
      console.log(
        `${factor.category}: ${factor.impact}/${factor.maxImpact} | ${factor.severity}`,
      );
      console.log(`Reason: ${factor.reason}`);

      if (factor.details) {
        console.log("Details:", factor.details);
      }

      console.log("");
    });

    console.log("DATA SNAPSHOT");
    console.log("----------------------------------------");
    console.log(result.dataSnapshot);

    console.log("\nCalculated at:", result.calculatedAt);

    console.log("\n========================================");
    console.log("TEST COMPLETE");
    console.log("========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("\nPROPERTY RISK TEST FAILED");
    console.error(error);
    process.exit(1);
  }
};

runTest();
